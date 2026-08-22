# 🐝 BeeSmart

> A modern, intelligent classroom management and educational platform.

BeeSmart is a feature-rich, interactive learning platform built for people creating and taking courses. It offers a dynamic classroom feed, robust assignment tracking, and a comprehensive calendar system to keep everyone on the same page.

## ✨ Features

- **Interactive Classroom Feed**: Teachers can create rich posts, drop assignments, and share files directly with the class.
- **Advanced Calendar**: A fully-featured weekly and monthly calendar with support for all-day events, custom time pickers, and seamless event management.
- **Secure Authentication**: Route protection and user dashboards powered by NextAuth, ensuring only authorized access to classroom resources.
- **Assignment Management**: End-to-end assignment handling, from creation and file uploads to learner submissions.
- **Modern UI/UX**: A beautiful, responsive interface utilizing modern aesthetics, smooth animations (Framer Motion), and accessible components (Radix UI).

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [Prisma](https://www.prisma.io/) with MariaDB
- **Authentication**: [Auth.js (NextAuth v5)](https://authjs.dev/)
- **UI Components**: Radix UI, Lucide/Hugeicons, Framer Motion

## Local setup

BeeSmart requires Node.js 20.9 or newer and MariaDB. Copy `.env.example` to `.env`, fill the local values, then run:

```bash
npm ci
npx prisma migrate deploy
npm run dev
```

## Production configuration

The production process validates its environment before `next start`. Required values are `DATABASE_URL`, an `AUTH_SECRET` of at least 32 characters, `AUTH_URL`, `DEEPSEEK_API_KEY`, an absolute durable `UPLOAD_STORAGE_DIR` shared by every application instance, and a reachable ClamAV configuration through `MALWARE_SCAN_MODE=clamav`, `CLAMAV_HOST`, and `CLAMAV_PORT`.

Google sign-in is enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present. `ADMIN_EMAILS` is a comma-separated, case-insensitive allowlist; an empty value disables admin access. `NEXT_PUBLIC_EARLY_ACCESS_FEEDBACK_ENABLED=true` enables the feedback surface.

## Production release

Before promoting a release:

```bash
npm ci
npm audit --omit=dev --audit-level=high
npx prisma validate
npx prisma migrate deploy
npm run lint
npm run audit:colors
npx tsc --noEmit
npm run test:run
npm run coverage
npm run build
npx playwright test
```

Follow [docs/security-deployment.md](docs/security-deployment.md) for backups, legacy file migration, sanitation, persistent storage, ClamAV, cleanup scheduling, and rollback.
