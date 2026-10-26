-- Psyche Core · Supabase schema, part 2: Compatibility + Group analysis
-- Run once in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- (Run schema.sql first if you haven't. This file is safe to re-run.)
--
-- What gets shared: only a display name + the five dimension scores + the 20 facet scores + the archetype key,
-- and ONLY with people who accepted a connection with you / members of a group you accepted.
-- Individual answers are never stored anywhere.

-- ---------- helpers ----------
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- ---------- tables ----------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  dims         jsonb,            -- {"P":..,"R":..,"I":..,"S":..,"M":..} or null until the test is taken
  arch_key     text,
  updated_at   timestamptz not null default now()
);

-- facet-level scores (the 20 narrower traits) power the deeper comparison; safe to re-run
alter table public.profiles add column if not exists facets jsonb;

create table if not exists public.connections (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references auth.users (id) on delete cascade,
  requester_email text not null,
  requester_name  text not null,
  addressee_id    uuid references auth.users (id) on delete cascade,
  invitee_email   text,                       -- set for email invites, null for share links
  token           text unique not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz
);

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  email      text not null,
  user_id    uuid references auth.users (id) on delete cascade,
  status     text not null default 'invited' check (status in ('invited', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (group_id, email)
);

-- ---------- security-definer helpers (avoid recursive RLS) ----------
create or replace function public.is_group_owner(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups g where g.id = gid and g.owner_id = auth.uid())
$$;

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m
                 where m.group_id = gid and m.user_id = auth.uid() and m.status = 'accepted')
$$;

create or replace function public.is_group_invitee(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m
                 where m.group_id = gid and lower(m.email) = public.my_email())
$$;

-- Can the signed-in user see this person's profile (scores)?
-- Only themselves, accepted connections, and people in a group both have accepted.
create or replace function public.can_see_profile(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (select 1 from public.connections c
               where c.status = 'accepted'
                 and ((c.requester_id = auth.uid() and c.addressee_id = target)
                   or (c.addressee_id = auth.uid() and c.requester_id = target)))
    or exists (select 1 from public.group_members a
               join public.group_members b on b.group_id = a.group_id
               where a.user_id = auth.uid() and a.status = 'accepted'
                 and b.user_id = target     and b.status = 'accepted')
$$;

-- ---------- RPCs (the only way a pending invite becomes accepted) ----------
create or replace function public.accept_connection(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.connections
     set addressee_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_id and status = 'pending'
     and requester_id <> auth.uid()
     and lower(invitee_email) = public.my_email();
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.accept_link(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.connections
     set addressee_id = auth.uid(), status = 'accepted', accepted_at = now()
   where token = p_token and status = 'pending'
     and invitee_email is null
     and requester_id <> auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.groups (name, owner_id) values (left(trim(p_name), 80), auth.uid()) returning id into gid;
  insert into public.group_members (group_id, email, user_id, status)
    values (gid, public.my_email(), auth.uid(), 'accepted');
  return gid;
end $$;

create or replace function public.accept_group_invite(p_gid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.group_members
     set user_id = auth.uid(), status = 'accepted'
   where group_id = p_gid and status = 'invited' and lower(email) = public.my_email();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.connections    enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
drop policy if exists "profiles delete" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated
  using (public.can_see_profile(user_id));
create policy "profiles insert" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and lower(email) = public.my_email());
create policy "profiles update" on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and lower(email) = public.my_email());
create policy "profiles delete" on public.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "connections read"   on public.connections;
drop policy if exists "connections insert" on public.connections;
drop policy if exists "connections delete" on public.connections;
create policy "connections read" on public.connections for select to authenticated
  using (requester_id = (select auth.uid())
      or addressee_id = (select auth.uid())
      or lower(invitee_email) = public.my_email());
create policy "connections insert" on public.connections for insert to authenticated
  with check (requester_id = (select auth.uid())
          and lower(requester_email) = public.my_email()
          and status = 'pending' and addressee_id is null
          and (invitee_email is null or lower(invitee_email) <> public.my_email()));
create policy "connections delete" on public.connections for delete to authenticated
  using (requester_id = (select auth.uid())
      or addressee_id = (select auth.uid())
      or (status = 'pending' and lower(invitee_email) = public.my_email()));

drop policy if exists "groups read"   on public.groups;
drop policy if exists "groups update" on public.groups;
drop policy if exists "groups delete" on public.groups;
create policy "groups read" on public.groups for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_member(id) or public.is_group_invitee(id));
create policy "groups update" on public.groups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "groups delete" on public.groups for delete to authenticated
  using (owner_id = (select auth.uid()));
-- (groups are created through create_group(), so there is no insert policy)

drop policy if exists "members read"   on public.group_members;
drop policy if exists "members insert" on public.group_members;
drop policy if exists "members delete" on public.group_members;
create policy "members read" on public.group_members for select to authenticated
  using (public.is_group_owner(group_id) or public.is_group_member(group_id)
      or user_id = (select auth.uid()) or lower(email) = public.my_email());
create policy "members insert" on public.group_members for insert to authenticated
  with check (public.is_group_owner(group_id) and status = 'invited' and user_id is null);
create policy "members delete" on public.group_members for delete to authenticated
  using (public.is_group_owner(group_id) or user_id = (select auth.uid()) or lower(email) = public.my_email());

-- ---------- grants ----------
revoke all on public.profiles, public.connections, public.groups, public.group_members from anon;
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, delete         on public.connections   to authenticated;
grant select, update, delete         on public.groups        to authenticated;
grant select, insert, delete         on public.group_members to authenticated;

revoke execute on function public.accept_connection(uuid), public.accept_link(text),
  public.create_group(text), public.accept_group_invite(uuid), public.can_see_profile(uuid),
  public.is_group_owner(uuid), public.is_group_member(uuid), public.is_group_invitee(uuid),
  public.my_email() from public, anon;
grant execute on function public.accept_connection(uuid), public.accept_link(text),
  public.create_group(text), public.accept_group_invite(uuid), public.can_see_profile(uuid),
  public.is_group_owner(uuid), public.is_group_member(uuid), public.is_group_invitee(uuid),
  public.my_email() to authenticated;

-- ---------- delete my account ----------
-- Lets a signed-in user permanently delete their own account from the app.
-- Deleting the auth user cascades (ON DELETE CASCADE) to: assessment_results, profiles,
-- connections they sent/accepted, group memberships, and any groups they OWN
-- (those groups disappear for every member). Pending invitations addressed to their
-- email are removed too, since those rows reference the email, not the user id.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); mail text := public.my_email();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.group_members where status = 'invited' and lower(email) = mail;
  delete from public.connections   where status = 'pending' and lower(invitee_email) = mail;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
