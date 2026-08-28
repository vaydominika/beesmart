# BeeSmart

BeeSmart is a web-based learning platform where teachers can manage classrooms and course material while students can follow assignments, submit work, and review their results. Anyone can also discover and complete standalone courses at their own pace, without needing to join a classroom.

Built with Next.js, React, Prisma, and MariaDB.

## Features

- Course creation with modules, lessons, files, and progress tracking
- Classrooms with posts, members, assignments, submissions, and grades
- Tests with multiple question types, attempts, and AI-assisted grading
- Personal schedules, reminders, notifications, and focus timers
- User profiles, course ratings, reports, and admin ticket management

## Local setup

BeeSmart requires Node.js 20.9 or newer and MariaDB. Copy `.env.example` to `.env`, fill in the values, then run:

```bash
npm ci
npx prisma migrate deploy
npm run dev
```

## Deployment

Production requires `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `DEEPSEEK_API_KEY`, an absolute `UPLOAD_STORAGE_DIR` on persistent storage, and a reachable ClamAV service configured with `MALWARE_SCAN_MODE=clamav`, `CLAMAV_HOST`, and `CLAMAV_PORT`.

Before deploying, run:

```bash
npm ci
npm audit --omit=dev --audit-level=high
npx prisma validate
npx prisma migrate deploy
npm run lint
npx tsc --noEmit
npm run test:run
npm run build
```

See [docs/security-deployment.md](docs/security-deployment.md) for storage, backups, migrations, cleanup jobs, and rollback notes.
