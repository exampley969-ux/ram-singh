-- Psyche Core · Phase 5 hardening migration
-- ---------------------------------------------------------------------------------------------
-- Run AFTER schema.sql and social.sql. Safe to re-run (idempotent). Run on a STAGING project first,
-- then run supabase/tests/rls.test.sql there, then apply to production.
--
-- STATUS: written and statically linted (tests/sql-policy.test.js) but NOT yet executed against a real
-- Postgres/Supabase project. Treat it as unverified until rls.test.sql passes on staging.
--
-- What this adds (finding ids refer to docs/DEFECTS.md):
--   D37  my_email() only returns an email that Supabase has CONFIRMED, so an unverified sign-up using
--          someone else's address cannot accept invitations or group invites addressed to that address.
--   D38  server-side shape / size limits on every user-writable JSON and text field.
--   D39  quotas on invitations, groups and group size (abuse / storage control).
--   D39  share links and invitations expire (14 days); failed link guesses are throttled per user.
--   D40  delete_my_result(): removes the saved result AND clears shared scores atomically.
--   D41  groups: only the name column can be updated by clients (owner_id/created_at are not client-writable).
--   D42  delete_my_account() no longer depends on the email being confirmed.
--   D41  clients can only set the intended columns when inserting invitations / group members (no self-chosen expiry or status).
-- ---------------------------------------------------------------------------------------------
begin;

-- ---------- D37: verified identity ----------
-- Previously read the (client-held) JWT 'email' claim. Now reads the live, confirmed address from auth.users.
-- Returns NULL (never '') when there is no confirmed email, so comparisons simply fail.
-- Requires "Confirm email" to be ON in Supabase Auth settings (otherwise accounts are confirmed automatically).
create or replace function public.my_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid() and u.email is not null and u.email_confirmed_at is not null
$$;

-- ---------- D38: validation helpers ----------
-- NB: CASE is used so a non-numeric value is never cast (SQL does not guarantee AND/OR evaluation order).
create or replace function public.valid_score_map(j jsonb, max_keys int) returns boolean
language sql immutable set search_path = public as $$
  select case
    when j is null then true
    when jsonb_typeof(j) <> 'object' then false
    else (select count(*) from jsonb_object_keys(j)) <= max_keys
         and octet_length(j::text) <= 2048
         and not exists (
           select 1 from jsonb_each(j) e
           where case when jsonb_typeof(e.value) = 'number'
                      then not ((e.value #>> '{}')::numeric between 0 and 100)
                      else true end)
  end
$$;

create or replace function public.valid_dims(j jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case
    when j is null then true
    when jsonb_typeof(j) <> 'object' then false
    else public.valid_score_map(j, 5) and j ?& array['P','R','I','S','M']
  end
$$;

-- add a constraint only if it does not exist yet (ADD CONSTRAINT has no IF NOT EXISTS)
create or replace function pg_temp.add_check(tbl regclass, cname text, expr text) returns void
language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = cname and conrelid = tbl) then
    execute format('alter table %s add constraint %I check (%s) not valid', tbl, cname, expr);
  end if;
end $$;

select pg_temp.add_check('public.profiles', 'profiles_dims_valid',      'public.valid_dims(dims)');
select pg_temp.add_check('public.profiles', 'profiles_facets_valid',    'public.valid_score_map(facets, 24)');
select pg_temp.add_check('public.profiles', 'profiles_arch_key_valid',  $c$arch_key is null or arch_key ~ '^[A-Za-z0-9_.-]{1,40}$'$c$);
select pg_temp.add_check('public.profiles', 'profiles_name_valid',      'char_length(display_name) between 1 and 40');
select pg_temp.add_check('public.profiles', 'profiles_email_valid',     $c$char_length(email) <= 254 and position('@' in email) > 1$c$);

-- the synced result is about 1-2 KB; 32 KB leaves ample headroom for future fields
select pg_temp.add_check('public.assessment_results', 'assessment_results_shape',
  $c$jsonb_typeof(result) = 'object' and octet_length(result::text) <= 32768 and not (result ? 'ans')$c$);

select pg_temp.add_check('public.connections', 'connections_names_valid',
  $c$char_length(requester_name) between 1 and 80 and char_length(requester_email) <= 254
     and (invitee_email is null or (char_length(invitee_email) <= 254 and position('@' in invitee_email) > 1))$c$);
select pg_temp.add_check('public.group_members', 'group_members_email_valid',
  $c$char_length(email) <= 254 and position('@' in email) > 1$c$);

-- Validate constraints against existing rows; if some old row violates one, report it instead of failing the migration.
do $$
declare r record;
begin
  for r in select conrelid::regclass as t, conname from pg_constraint
           where conname in ('profiles_dims_valid','profiles_facets_valid','profiles_arch_key_valid','profiles_name_valid',
                             'profiles_email_valid','assessment_results_shape','connections_names_valid','group_members_email_valid')
             and not convalidated loop
    begin
      execute format('alter table %s validate constraint %I', r.t, r.conname);
    exception when others then
      raise warning 'constraint % on % applies to new writes, but existing rows violate it. Fix those rows, then run: alter table % validate constraint %;', r.conname, r.t, r.t, r.conname;
    end;
  end loop;
end $$;

-- ---------- D39: quotas ----------
create or replace function public.enforce_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_table_name = 'connections' then
    select count(*) into n from public.connections where requester_id = new.requester_id;
    if n >= 100 then raise exception 'connection limit reached'; end if;
    select count(*) into n from public.connections where requester_id = new.requester_id and status = 'pending';
    if n >= 25 then raise exception 'too many pending invitations'; end if;
  elsif tg_table_name = 'group_members' then
    select count(*) into n from public.group_members where group_id = new.group_id;
    if n >= 100 then raise exception 'group size limit reached'; end if;
  elsif tg_table_name = 'groups' then
    select count(*) into n from public.groups where owner_id = new.owner_id;
    if n >= 25 then raise exception 'group limit reached'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_quota() from public, anon, authenticated;

drop trigger if exists connections_quota   on public.connections;
drop trigger if exists group_members_quota on public.group_members;
drop trigger if exists groups_quota        on public.groups;
create trigger connections_quota   before insert on public.connections   for each row execute function public.enforce_quota();
create trigger group_members_quota before insert on public.group_members for each row execute function public.enforce_quota();
create trigger groups_quota        before insert on public.groups        for each row execute function public.enforce_quota();

-- ---------- D39: expiry + throttling ----------
alter table public.connections add column if not exists expires_at timestamptz;
update public.connections set expires_at = now() + interval '14 days' where status = 'pending' and expires_at is null;
alter table public.connections alter column expires_at set default (now() + interval '14 days');

create table if not exists public.rpc_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null,
  at      timestamptz not null default now()
);
create index if not exists rpc_attempts_lookup on public.rpc_attempts (user_id, kind, at);
alter table public.rpc_attempts enable row level security;   -- no policies: only the security-definer functions below touch it
revoke all on public.rpc_attempts from anon, authenticated;

create or replace function public.accept_connection(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.connections
     set addressee_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_id and status = 'pending'
     and requester_id <> auth.uid()
     and lower(invitee_email) = public.my_email()
     and (expires_at is null or expires_at > now());
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.accept_link(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int; uid uuid := auth.uid(); fails int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if public.my_email() is null then raise exception 'verify your email first'; end if;
  select count(*) into fails from public.rpc_attempts
   where user_id = uid and kind = 'accept_link' and at > now() - interval '1 hour';
  if fails >= 10 then raise exception 'too many attempts, try again later'; end if;
  update public.connections
     set addressee_id = uid, status = 'accepted', accepted_at = now()
   where token = p_token and status = 'pending'
     and invitee_email is null
     and requester_id <> uid
     and (expires_at is null or expires_at > now());
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.rpc_attempts (user_id, kind) values (uid, 'accept_link');
    delete from public.rpc_attempts where at < now() - interval '1 day';
  end if;
  return n > 0;
end $$;

-- Removes expired, never-accepted invitations and links. Schedule it (Supabase: Database -> Extensions -> pg_cron):
--   select cron.schedule('purge-expired-invitations', '17 3 * * *', $$select public.purge_expired_invitations()$$);
create or replace function public.purge_expired_invitations() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.connections where status = 'pending' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_expired_invitations() from public, anon, authenticated;

-- ---------- groups: verified creator ----------
create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid; mail text := public.my_email();
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if mail is null then raise exception 'verify your email first'; end if;
  insert into public.groups (name, owner_id) values (left(trim(p_name), 80), auth.uid()) returning id into gid;
  insert into public.group_members (group_id, email, user_id, status) values (gid, mail, auth.uid(), 'accepted');
  return gid;
end $$;

-- ---------- D40: atomic result deletion ----------
create or replace function public.delete_my_result() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.assessment_results where user_id = auth.uid();
  update public.profiles set dims = null, facets = null, arch_key = null, updated_at = now() where user_id = auth.uid();
end $$;
revoke execute on function public.delete_my_result() from public, anon;
grant  execute on function public.delete_my_result() to authenticated;

-- ---------- D41: column-level write access on groups ----------
revoke update on public.groups from authenticated;
grant  update (name) on public.groups to authenticated;

-- ---------- D41: clients choose only the fields they should ----------
-- Without this, a client could insert its own expires_at (never expire), status or addressee_id. Defaults still apply to omitted columns.
-- Re-run this file after any re-run of social.sql (social.sql re-grants table-wide INSERT).
revoke insert on public.connections   from authenticated;
grant  insert (requester_id, requester_email, requester_name, invitee_email) on public.connections to authenticated;
revoke insert on public.group_members from authenticated;
grant  insert (group_id, email) on public.group_members to authenticated;

-- ---------- D42: account deletion independent of email confirmation ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); mail text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select lower(email) into mail from auth.users where id = uid;
  delete from public.group_members where status = 'invited' and lower(email) = mail;
  delete from public.connections   where status = 'pending' and lower(invitee_email) = mail;
  delete from auth.users where id = uid;   -- cascades to every table that references auth.users
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ---------- OPTIONAL (verify on staging first): hide other people's email addresses ----------
-- profiles.email is only needed to check ownership on write; the app never reads it back. Column privileges would stop
-- connections and group members from reading each other's address through the API. Left commented out because policy
-- expressions that reference a column interact with column privileges and must be tested on your Supabase version.
--   revoke select on public.profiles from authenticated;
--   grant  select (user_id, display_name, dims, facets, arch_key, updated_at) on public.profiles to authenticated;

-- ---------- final guard: report any table in public that lacks Row Level Security ----------
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise warning 'table public.% has Row Level Security DISABLED', t.relname;
  end loop;
end $$;

commit;
