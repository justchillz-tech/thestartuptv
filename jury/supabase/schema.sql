-- Startup TV Short Film Festival Jury Portal
-- Run this in the Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create table if not exists public.juries (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'jury' check (role in ('jury', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  film_code text not null unique,
  title text not null,
  director text not null,
  duration text not null,
  language text not null,
  drive_url text not null,
  drive_file_id text not null unique,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'finalist', 'winner')),
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  jury_id uuid not null references public.juries(id) on delete cascade,
  film_id uuid not null references public.films(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (jury_id, film_id)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  jury_id uuid not null references public.juries(id) on delete restrict,
  film_id uuid not null references public.films(id) on delete restrict,
  drive_file_id text not null references public.films(drive_file_id) on delete restrict,
  film_url text not null,
  story_narrative integer not null check (story_narrative between 0 and 15),
  direction integer not null check (direction between 0 and 15),
  screenplay integer not null check (screenplay between 0 and 10),
  cinematography integer not null check (cinematography between 0 and 10),
  acting integer not null check (acting between 0 and 10),
  editing integer not null check (editing between 0 and 10),
  originality integer not null check (originality between 0 and 10),
  sound integer not null check (sound between 0 and 5),
  production_design integer not null check (production_design between 0 and 5),
  overall_impact integer not null check (overall_impact between 0 and 10),
  total integer not null check (total between 0 and 100),
  remarks text,
  submitted_at timestamptz not null default now(),
  unique (jury_id, film_id),
  unique (jury_id, drive_file_id)
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.juries
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

grant select, insert, update, delete on public.juries to authenticated;
grant select, insert, update, delete on public.films to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert on public.evaluations to authenticated;

alter table public.juries enable row level security;
alter table public.films enable row level security;
alter table public.assignments enable row level security;
alter table public.evaluations enable row level security;

-- Juries can see their own profile. Admins can manage all profiles.
drop policy if exists "juries_select_own_or_admin" on public.juries;
create policy "juries_select_own_or_admin" on public.juries
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "juries_admin_manage" on public.juries;
create policy "juries_admin_manage" on public.juries
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Films are visible only when assigned to the current jury, or to admins.
drop policy if exists "films_select_assigned_or_admin" on public.films;
create policy "films_select_assigned_or_admin" on public.films
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.assignments a
    where a.film_id = films.id and a.jury_id = auth.uid()
  )
);

drop policy if exists "films_admin_manage" on public.films;
create policy "films_admin_manage" on public.films
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- A jury can only see its own assignments. Admins can manage all assignments.
drop policy if exists "assignments_select_own_or_admin" on public.assignments;
create policy "assignments_select_own_or_admin" on public.assignments
for select to authenticated
using (jury_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_insert_admin" on public.assignments;
create policy "assignments_insert_admin" on public.assignments
for insert to authenticated
with check (public.is_admin());

drop policy if exists "assignments_update_own_or_admin" on public.assignments;
create policy "assignments_update_own_or_admin" on public.assignments
for update to authenticated
using (jury_id = auth.uid() or public.is_admin())
with check (jury_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_delete_admin" on public.assignments;
create policy "assignments_delete_admin" on public.assignments
for delete to authenticated
using (public.is_admin());

-- Jury members can only read their own evaluations and insert an evaluation
-- for a film assigned to them. There is deliberately no jury update/delete policy.
drop policy if exists "evaluations_select_own_or_admin" on public.evaluations;
create policy "evaluations_select_own_or_admin" on public.evaluations
for select to authenticated
using (jury_id = auth.uid() or public.is_admin());

drop policy if exists "evaluations_insert_assigned" on public.evaluations;
create policy "evaluations_insert_assigned" on public.evaluations
for insert to authenticated
with check (
  jury_id = auth.uid()
  and exists (
    select 1 from public.assignments a
    where a.jury_id = auth.uid()
      and a.film_id = evaluations.film_id
      and a.status = 'pending'
  )
  and exists (
    select 1 from public.films f
    where f.id = evaluations.film_id
      and f.drive_file_id = evaluations.drive_file_id
  )
);
