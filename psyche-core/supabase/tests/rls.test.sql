-- Psyche Core · Row Level Security + privilege regression test (Phase 5)
-- =====================================================================================================
-- RUN ON A STAGING PROJECT ONLY (never production). It creates test users in auth.users, and everything
-- happens inside ONE transaction that ends with ROLLBACK, so nothing is left behind.
--
--   Supabase SQL editor : paste the whole file and run it
--   psql                : psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
--
-- Prerequisites: schema.sql, social.sql and phase5-hardening.sql already applied.
-- Result: every check prints a NOTICE "ok ..." ; the first failure raises "FAIL [...]" and stops the script.
-- A run that reaches the final line "RLS tests finished: all checks passed" has passed.
--
-- STATUS: this file has not been executed by its author (no Postgres was available). Expect that the first run on
-- staging may need small adjustments (e.g. auth.users column defaults on your Supabase version). A failure caused by
-- the test harness itself is not a security finding; a FAIL on a policy check is.
-- =====================================================================================================
begin;

-- ---------- harness (lives in a throw-away schema that is rolled back with everything else) ----------
create schema psyche_test;
grant usage on schema psyche_test to anon, authenticated;

create function psyche_test.act_as(uid uuid) returns void language plpgsql as $$
declare mail text;
begin
  execute 'reset role';
  select email into mail from auth.users where id = uid;
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated', 'email', mail)::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create function psyche_test.expect_rows(label text, q text, want int) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || q || ') t' into n;
  if n <> want then raise exception 'FAIL [%]: got % row(s), expected %', label, n, want; end if;
  raise notice 'ok   %', label;
end $$;

create function psyche_test.expect_affected(label text, q text, want int) returns void language plpgsql as $$
declare n int;
begin
  execute q; get diagnostics n = row_count;
  if n <> want then raise exception 'FAIL [%]: % row(s) affected, expected %', label, n, want; end if;
  raise notice 'ok   %', label;
end $$;

create function psyche_test.expect_error(label text, q text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute q; exception when others then failed := true; end;
  if not failed then raise exception 'FAIL [%]: statement was accepted but must be rejected: %', label, q; end if;
  raise notice 'ok   %', label;
end $$;

create function psyche_test.expect_true(label text, q text) returns void language plpgsql as $$
declare v boolean;
begin
  execute q into v;
  if v is distinct from true then raise exception 'FAIL [%]: expected true, got %', label, v; end if;
  raise notice 'ok   %', label;
end $$;

grant execute on all functions in schema psyche_test to anon, authenticated;

-- ---------- fixtures (as the table owner) ----------
reset role;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', now(), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local',   now(), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', now(), now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local',  null,  now(), now());  -- UNVERIFIED email

-- =====================================================================================================
-- T1  anonymous visitors have no access at all
-- =====================================================================================================
reset role; set local role anon;
select psyche_test.expect_error('anon cannot read assessment_results', 'select * from public.assessment_results');
select psyche_test.expect_error('anon cannot read profiles',           'select * from public.profiles');
select psyche_test.expect_error('anon cannot read connections',        'select * from public.connections');
select psyche_test.expect_error('anon cannot read groups',             'select * from public.groups');
select psyche_test.expect_error('anon cannot read group_members',      'select * from public.group_members');
select psyche_test.expect_error('anon cannot call accept_link',        $$select public.accept_link('x')$$);
select psyche_test.expect_error('anon cannot call delete_my_account',  'select public.delete_my_account()');

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select psyche_test.expect_error('signed-in users cannot read the throttle table', 'select * from public.rpc_attempts');

-- =====================================================================================================
-- T2  user A cannot read, edit or delete user B's private result
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.assessment_results (user_id, result) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"schema":1,"dims":{"P":60}}');
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
insert into public.assessment_results (user_id, result) values ('aaaaaaaa-0000-0000-0000-000000000002', '{"schema":1,"dims":{"P":10}}');

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select psyche_test.expect_rows('alice sees only her own result', 'select 1 from public.assessment_results', 1);
select psyche_test.expect_rows('alice cannot read bob''s result by id', $$select 1 from public.assessment_results where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, 0);
select psyche_test.expect_affected('alice cannot update bob''s result', $$update public.assessment_results set result = '{"x":1}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, 0);
select psyche_test.expect_affected('alice cannot delete bob''s result', $$delete from public.assessment_results where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, 0);
select psyche_test.expect_error('alice cannot insert a result for bob', $$insert into public.assessment_results (user_id, result) values ('aaaaaaaa-0000-0000-0000-000000000002', '{}')$$);
select psyche_test.expect_error('alice cannot re-assign her row to bob (changing user_id)', $$update public.assessment_results set user_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);

-- =====================================================================================================
-- T3  server-side validation of what clients may store
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.profiles (user_id, email, display_name, dims, facets, arch_key)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice',
        '{"P":60,"R":44,"I":44,"S":44,"M":60}', '{"P.abstraction":50,"P.curiosity":70}', 'TWIN_SM');
select psyche_test.expect_error('dimension score above 100 is rejected',  $$update public.profiles set dims = '{"P":101,"R":1,"I":1,"S":1,"M":1}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('non-numeric dimension score is rejected', $$update public.profiles set dims = '{"P":"x","R":1,"I":1,"S":1,"M":1}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('missing dimension is rejected',           $$update public.profiles set dims = '{"P":1}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('facet map larger than 24 entries is rejected', $$update public.profiles set facets = (select jsonb_object_agg('f' || g, 50) from generate_series(1, 30) g) where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('archetype key with markup is rejected',   $$update public.profiles set arch_key = '<img src=x>' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('display name over 40 characters is rejected', $$update public.profiles set display_name = repeat('n', 41) where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('oversized saved result is rejected',      $$update public.assessment_results set result = jsonb_build_object('pad', repeat('x', 40000)) where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('saved result containing raw answers is rejected', $$update public.assessment_results set result = '{"ans":[1,2,3],"dims":{}}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('profile email must be the signed-in email', $$update public.profiles set email = 'someone@else.com' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select psyche_test.expect_error('profile cannot be moved to another user id', $$update public.profiles set user_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
insert into public.profiles (user_id, email, display_name, dims, facets, arch_key)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@test.local', 'Bob',
        '{"P":10,"R":20,"I":30,"S":40,"M":50}', '{"P.abstraction":20}', 'TWIN_SM');
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000003');
insert into public.profiles (user_id, email, display_name, dims, facets, arch_key)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'carol@test.local', 'Carol',
        '{"P":90,"R":80,"I":70,"S":60,"M":50}', '{"P.abstraction":90}', 'TWIN_SM');

-- =====================================================================================================
-- T4  profiles are visible only to accepted connections / shared-group members
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select psyche_test.expect_rows('alice sees only her own profile before connecting', 'select 1 from public.profiles', 1);
select psyche_test.expect_error('client cannot choose its own link expiry', $$insert into public.connections (requester_id, requester_email, requester_name, expires_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', now() + interval '10 years')$$);
select psyche_test.expect_error('client cannot forge an accepted connection', $$insert into public.connections (requester_id, requester_email, requester_name, status, addressee_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', 'accepted', 'aaaaaaaa-0000-0000-0000-000000000003')$$);
select psyche_test.expect_error('client cannot invite itself', $$insert into public.connections (requester_id, requester_email, requester_name, invitee_email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', 'alice@test.local')$$);

with c as (insert into public.connections (requester_id, requester_email, requester_name)
           values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice') returning token)
select set_config('psyche.tok', (select token from c), true);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select psyche_test.expect_rows('carol (unconnected) cannot see alice or bob', $$select 1 from public.profiles where user_id <> 'aaaaaaaa-0000-0000-0000-000000000003'$$, 0);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
select psyche_test.expect_rows('bob cannot see alice before accepting', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0);
select psyche_test.expect_true('bob accepts the share link', format('select public.accept_link(%L)', current_setting('psyche.tok')));
select psyche_test.expect_rows('bob sees alice after accepting', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 1);
select psyche_test.expect_true('a used link cannot be accepted again', format('select not public.accept_link(%L)', current_setting('psyche.tok')));

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select psyche_test.expect_rows('alice sees bob after he accepted', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, 1);
select psyche_test.expect_affected('alice removes the connection', $$delete from public.connections where status = 'accepted'$$, 1);
select psyche_test.expect_rows('after removal alice cannot see bob', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$, 0);
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
select psyche_test.expect_rows('after removal bob cannot see alice', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 0);

-- =====================================================================================================
-- T5  an unverified email cannot claim invitations addressed to that address
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
with c as (insert into public.connections (requester_id, requester_email, requester_name, invitee_email)
           values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', 'dave@test.local') returning id)
select set_config('psyche.cid', (select id::text from c), true);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000004');
select psyche_test.expect_true('unverified dave cannot accept an invitation to his address', format('select not public.accept_connection(%L)', current_setting('psyche.cid')));
select psyche_test.expect_error('unverified dave cannot publish a profile', $$insert into public.profiles (user_id, email, display_name) values ('aaaaaaaa-0000-0000-0000-000000000004', 'dave@test.local', 'Dave')$$);
select psyche_test.expect_error('unverified dave cannot create a group', $$select public.create_group('x')$$);
reset role;
update auth.users set email_confirmed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000004');
select psyche_test.expect_true('dave accepts after confirming his email', format('select public.accept_connection(%L)', current_setting('psyche.cid')));

-- =====================================================================================================
-- T6  groups: membership, removal, privilege escalation
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('psyche.gid', public.create_group('Team')::text, true);
select psyche_test.expect_error('owner cannot insert a pre-accepted member', format($$insert into public.group_members (group_id, email, status) values (%L, 'x@test.local', 'accepted')$$, current_setting('psyche.gid')));
select psyche_test.expect_error('owner cannot reassign group ownership', format($$update public.groups set owner_id = 'aaaaaaaa-0000-0000-0000-000000000002' where id = %L$$, current_setting('psyche.gid')));
select psyche_test.expect_error('clients cannot insert groups directly (only create_group())', $$insert into public.groups (name, owner_id) values ('g', 'aaaaaaaa-0000-0000-0000-000000000001')$$);
insert into public.group_members (group_id, email) values (current_setting('psyche.gid')::uuid, 'bob@test.local'), (current_setting('psyche.gid')::uuid, 'carol@test.local');

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
select psyche_test.expect_true('bob accepts the group invite', format('select public.accept_group_invite(%L)', current_setting('psyche.gid')));
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select psyche_test.expect_true('carol accepts the group invite', format('select public.accept_group_invite(%L)', current_setting('psyche.gid')));
select psyche_test.expect_affected('a member cannot rename the group', format($$update public.groups set name = 'hacked' where id = %L$$, current_setting('psyche.gid')), 0);
select psyche_test.expect_error('a member cannot invite people', format($$insert into public.group_members (group_id, email) values (%L, 'evil@test.local')$$, current_setting('psyche.gid')));
select psyche_test.expect_affected('a member cannot delete the group', format($$delete from public.groups where id = %L$$, current_setting('psyche.gid')), 0);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
select psyche_test.expect_rows('bob (member) sees carol through the shared group', $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 1);

-- the owner removes bob. Bob keeps using the SAME session (same JWT claims): access must disappear immediately.
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select psyche_test.expect_affected('owner removes bob from the group', format($$delete from public.group_members where group_id = %L and email = 'bob@test.local'$$, current_setting('psyche.gid')), 1);
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
select psyche_test.expect_rows('removed member can no longer read the group',   format('select 1 from public.groups where id = %L', current_setting('psyche.gid')), 0);
select psyche_test.expect_rows('removed member can no longer read the member list', format('select 1 from public.group_members where group_id = %L', current_setting('psyche.gid')), 0);
select psyche_test.expect_rows('removed member can no longer see other members'' profiles', $$select 1 from public.profiles where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003')$$, 0);

-- =====================================================================================================
-- T7  link expiry and brute-force throttling
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
with c as (insert into public.connections (requester_id, requester_email, requester_name)
           values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice') returning token)
select set_config('psyche.tok2', (select token from c), true);
reset role;
update public.connections set expires_at = now() - interval '1 minute' where token = current_setting('psyche.tok2');
select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select psyche_test.expect_true('an expired share link cannot be accepted', format('select not public.accept_link(%L)', current_setting('psyche.tok2')));
do $$ begin for i in 1..9 loop perform public.accept_link('guess' || i); end loop; end $$;
select psyche_test.expect_error('the 11th failed link guess within an hour is throttled', $$select public.accept_link('guess-final')$$);

-- =====================================================================================================
-- T8  quotas
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin for i in 1..24 loop
  insert into public.connections (requester_id, requester_email, requester_name, invitee_email)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', 'quota' || i || '@test.local');
end loop; end $$;
select psyche_test.expect_error('more than 25 pending invitations are rejected', $$insert into public.connections (requester_id, requester_email, requester_name, invitee_email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local', 'Alice', 'quota-over@test.local')$$);

-- =====================================================================================================
-- T9  deletion: result + shared scores atomically, then the whole account
-- =====================================================================================================
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select public.delete_my_result();
select psyche_test.expect_rows('delete_my_result removes the saved result', 'select 1 from public.assessment_results', 0);
select psyche_test.expect_true('delete_my_result clears the shared scores in the same step', $$select dims is null and facets is null and arch_key is null from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);

reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000002');
insert into public.connections (requester_id, requester_email, requester_name, invitee_email)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@test.local', 'Bob', 'carol@test.local');
reset role; select psyche_test.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select public.delete_my_account();
reset role;
select psyche_test.expect_rows('deleted account is gone from auth.users', $$select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 0);
select psyche_test.expect_rows('deleted account''s profile is gone',      $$select 1 from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 0);
select psyche_test.expect_rows('deleted account''s group membership is gone', $$select 1 from public.group_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 0);
select psyche_test.expect_rows('invitations addressed to the deleted email are gone', $$select 1 from public.connections where lower(invitee_email) = 'carol@test.local'$$, 0);
select psyche_test.expect_rows('throttle records of the deleted account are gone', $$select 1 from public.rpc_attempts where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, 0);

reset role;
do $$ begin raise notice 'RLS tests finished: all checks passed'; end $$;
rollback;
