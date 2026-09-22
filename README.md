# Utsavaloka v2 — full module build

Utsavaloka is being built as a real institutional campus operating system, not a static dashboard.

## Build scope

### Club management / Student life
- Students
- Clubs
- Club membership data model
- Events
- Registrations
- QR event attendance
- Participation automation
- Certificates
- Activity records
- Achievements

### Academics
- Academic attendance sessions
- Marks
- Courses
- Timetable
- Exams
- Student academic record

### Communication
- Notices
- Notifications
- Circulars
- Deadlines

### Administration
- Dashboard
- Live operational reports
- Audit logs
- Institution/user roles
- Settings

## Architecture
- Next.js 16 App Router
- React 19
- TypeScript
- Supabase PostgreSQL
- Supabase Auth
- PostgreSQL Row Level Security
- Next.js Route Handlers
- Client UI only calls authenticated server endpoints
- QR attendance uses short-lived hashed session tokens

The application is structured around real records and relationships. Pages do not invent students, events, marks or attendance just to make the interface look populated.

## Connection policy
**Do not configure deployment or production credentials in this branch.**
The application contains the connection layer, but the actual Supabase project/environment connection is deliberately the final step after the UI, API, schema and workflows have been verified.
No Vercel deployment has been performed by this build.

## Final connection steps
1. Create/choose the Supabase project.
2. Run database/schema.sql.
3. Create the first Auth user.
4. Link the user to an institution/profile.
5. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the local environment.
6. Verify login, RLS, CRUD, QR attendance and reports locally.
7. Only after verification, configure the same variables in Vercel manually.
Never commit Supabase secret keys or production credentials.

## Important workflow
Event → Registration → QR Attendance → Participation → Certificate → Report
A verified event attendance insert automatically creates a participation record and an activity record through the database trigger.

## Current Git branch
`Uloka-v2`
This branch is the verification build. The older `Uloka` prototype is preserved separately.