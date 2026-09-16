-- Participant submission intake from the public Google Form response sheet.
-- Run after schema.sql in the Supabase SQL Editor.

create table if not exists public.film_submissions (
  id uuid primary key default gen_random_uuid(),
  source_row_id text not null unique,
  submitted_at timestamptz,
  participant_email text,
  submitted_email text,
  participant_name text not null,
  contact_number text,
  organization text,
  title text not null,
  genre text,
  duration text,
  production_year text,
  director_name text,
  producer_name text,
  language text,
  synopsis text,
  cast_crew text,
  film_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_film_id uuid references public.films(id) on delete set null,
  reviewed_by uuid references public.juries(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists film_submissions_status_idx
  on public.film_submissions(status);

create index if not exists film_submissions_submitted_at_idx
  on public.film_submissions(submitted_at desc);

create or replace function public.set_film_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists film_submissions_updated_at on public.film_submissions;
create trigger film_submissions_updated_at
before update on public.film_submissions
for each row execute function public.set_film_submissions_updated_at();

grant select, insert, update on public.film_submissions to authenticated;

alter table public.film_submissions enable row level security;

drop policy if exists "film_submissions_admin_read" on public.film_submissions;
create policy "film_submissions_admin_read" on public.film_submissions
for select to authenticated
using (public.is_admin());

drop policy if exists "film_submissions_admin_insert" on public.film_submissions;
create policy "film_submissions_admin_insert" on public.film_submissions
for insert to authenticated
with check (public.is_admin());

drop policy if exists "film_submissions_admin_update" on public.film_submissions;
create policy "film_submissions_admin_update" on public.film_submissions
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
