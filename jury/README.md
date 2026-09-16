# Startup TV Jury Portal

Private jury evaluation portal for the Startup TV Short Film Festival.

## Stack

- Next.js App Router
- Supabase Auth + Postgres + Row Level Security
- Vercel

## Local setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
4. Install dependencies from this directory with `npm install`.
5. Start with `npm run dev`.

## Data model

- `juries` — jury members and admins
- `films` — submitted films and their canonical Google Drive file IDs
- `assignments` — which jury member can evaluate which film
- `evaluations` — the final 100-point evaluation

A jury member can submit an evaluation only for an assigned film. The database enforces uniqueness for both `(jury_id, film_id)` and `(jury_id, drive_file_id)`.

## Film URL validation

The evaluation form accepts a Google Drive URL, extracts the underlying file ID, verifies that it matches the assigned film, and checks whether that jury member has already submitted an evaluation for that file.

The same checks are performed server-side before saving the evaluation. The database also has unique constraints as the final duplicate-protection layer.
