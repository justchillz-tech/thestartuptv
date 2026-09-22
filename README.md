# Utsavaloka v2
A real institutional platform rebuild using Next.js 16, Supabase PostgreSQL, Supabase Auth and Row Level Security.

## Current foundation
- Real Next.js App Router application
- Supabase browser/server clients with SSR cookie sessions
- Next.js 16 Proxy for session refresh and protected routes
- Institution-scoped PostgreSQL schema
- Role-aware RLS policies
- Live dashboard, students and clubs queries
- Event GET/POST API and database-backed event creation
- Login screen and health endpoint
- Explicit empty/setup states instead of fake data

## Setup
1. Create a Supabase project.
2. Copy .env.example to .env.local.
3. Run database/schema.sql in Supabase SQL Editor.
4. Optionally run database/seed.sql.
5. Create the first user in Supabase Authentication.
6. Link that user's UUID to the institution using the SQL comment in database/seed.sql.
7. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to Vercel. Keep SUPABASE_SECRET_KEY server-only.

## Build sequence
1. Institution/user administration
2. Event registration
3. QR attendance
4. Participation automation
5. Certificate generation and verification
6. Academic attendance, marks, timetable and exams
7. Communication
8. Reports, audit logs and exports

No secrets belong in GitHub. Publishable keys are for browser use with RLS; secret keys are backend-only.