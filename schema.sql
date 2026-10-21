-- Psyche Core · Supabase schema
-- Run once in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.assessment_results (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  result     jsonb       not null,
  result_at  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: each signed-in user can only touch their own row.
alter table public.assessment_results enable row level security;

drop policy if exists "read own result"   on public.assessment_results;
drop policy if exists "insert own result" on public.assessment_results;
drop policy if exists "update own result" on public.assessment_results;
drop policy if exists "delete own result" on public.assessment_results;

create policy "read own result"   on public.assessment_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own result" on public.assessment_results
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own result" on public.assessment_results
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own result" on public.assessment_results
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get no access at all.
revoke all on public.assessment_results from anon;
grant select, insert, update, delete on public.assessment_results to authenticated;
