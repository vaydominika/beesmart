# Security hardening deployment

## Required configuration

- Set `UPLOAD_STORAGE_DIR` to an absolute path on durable storage mounted at the same path on every application instance. The application refuses private file operations in production when it is absent; ephemeral or instance-local filesystems are not supported.
- Set `MALWARE_SCAN_MODE=clamav`, `CLAMAV_HOST`, and `CLAMAV_PORT`. Production startup validation rejects disabled or incomplete malware scanning. `CLAMAV_TIMEOUT_MS` is optional.
- Optionally set `MODERATION_TIMEOUT_MS`; the default is 15000 ms.
- Back up both the database and `public/uploads` before applying the migration.

## Rollout

1. Back up the production database and the complete legacy `public/uploads` tree. Rehearse restore before continuing.
2. Run `npm run validate:env`, then apply every pending migration with `npm run db:migrate:deploy`. This includes `20260809120000_security_hardening` and `20260821120000_production_hardening`.
3. Run `npm run sanitize:rich-text` and `npm run migrate:private-files` to review dry-run counts.
4. Run `npm run sanitize:rich-text -- --apply`.
5. Run `npm run migrate:private-files -- --apply --remove-public`. Course files, covers, avatars, and banners are copied, checksummed, scanned, attached in the database, and only then removed from `public/uploads`.
6. Verify that active course, post, submission, cover, avatar, and banner records reference an attached `StoredFile`.
7. Schedule `npm run files:cleanup` once per hour under the same OS account and environment as the application. It removes expired uploads, retries deletion-pending files, and clears expired rate-limit buckets.
8. Confirm security headers at the public HTTPS endpoint and run the complete release matrix from the README against the release artifact.

Examples: use a systemd timer on Linux or an hourly Task Scheduler job on Windows. Do not run cleanup from a machine that does not mount the same `UPLOAD_STORAGE_DIR`.

## Rollback

Do not use `--remove-public` until the new application version is ready. During the migration window the nullable legacy `fileUrl` columns remain supported, allowing the application version to be rolled back while public files are still present.
