# Security hardening deployment

## Required configuration

- Set `UPLOAD_STORAGE_DIR` to an absolute path on persistent local storage. The application refuses private file operations in production when it is absent.
- Set `MALWARE_SCAN_MODE=off` or `MALWARE_SCAN_MODE=clamav` explicitly. For ClamAV, configure `CLAMAV_HOST`, `CLAMAV_PORT`, and optionally `CLAMAV_TIMEOUT_MS`.
- Optionally set `MODERATION_TIMEOUT_MS`; the default is 15000 ms.
- Back up both the database and `public/uploads` before applying the migration.

## Rollout

1. Apply the `20260809120000_security_hardening` Prisma migration.
2. Run `npm run sanitize:rich-text` and `npm run migrate:private-files` to review dry-run counts.
3. Run `npm run sanitize:rich-text -- --apply`.
4. Run `npm run migrate:private-files -- --apply --remove-public`. Files are copied, checksummed, scanned according to configuration, attached in the database, and only then removed from `public/uploads`.
5. Verify that no active `CourseFile`, `PostFile`, `SubmissionFile`, or local course cover has a missing `storedFileId`.
6. Schedule `npm run files:cleanup` once per hour under the same OS account and environment as the application. The command is idempotent and retries deletion-pending files while expiring unclaimed uploads after 24 hours.

Examples: use a systemd timer on Linux or an hourly Task Scheduler job on Windows. Do not run cleanup from a machine that does not mount the same `UPLOAD_STORAGE_DIR`.

## Rollback

Do not use `--remove-public` until the new application version is ready. During the migration window the nullable legacy `fileUrl` columns remain supported, allowing the application version to be rolled back while public files are still present.
