# User image, grade, and test-attempt consolidation

This migration removes three sources of duplicated state:

- `User.image` becomes the single profile-image URL used by Auth.js and the application. Existing BeeSmart `avatar` values take precedence over provider images. The managed-file foreign key is renamed from `avatarFileId` to `imageFileId`.
- `TestAttempt.submittedAt` becomes the authoritative completion indicator. Completed legacy rows without a submission timestamp receive their last update time before `isCompleted` is removed.
- A grade is uniquely identified by its user and assigned work. If historical duplicates exist, the most recently updated row is retained before the composite unique index is created. The application writes the grade and submission state in one transaction.

## Deliberately retained fields

The audit did not remove fields that carry distinct behaviour or migration data. Auth.js account, session, verification, `emailVerified`, and `image` fields remain compatible with its Prisma adapter. Course and banner URL fields and the `Attachment.legacyFile*` columns remain as fallbacks for files that may not yet have been imported into private storage. Reminder and notification snapshot fields remain because they support existing dashboard queries and preserve the text displayed for historical notifications.

## Deployment

Stop application writes and back up the database before applying the migration. Old and new application versions cannot share this schema during a rolling deployment because the user-image and test-attempt columns change. Apply the migration with `npm run db:migrate:deploy`, then start the matching application build.
