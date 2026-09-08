# Attachment and visibility cleanup

This migration reduces the schema from 43 models to 40. `Attachment` replaces
`CourseFile`, `PostFile`, `SubmissionFile`, and `ReportAttachment`. IDs, destinations,
course uploader attribution, and visibility are preserved. Managed file metadata
comes from `StoredFile`; unimported uploads retain their metadata in nullable
`legacyFile*` fields. The private-file import script clears those fields when it
attaches a managed file.

`Course.visibility` is authoritative. The migration drops `isPublic` without
promoting private or invitation-only courses. Legacy API requests using `isPublic`
are translated into `visibility`, with an explicit visibility value taking priority.
Seven exact duplicate indexes are removed; their unique indexes remain.

## Deployment

Stop application writes, back up the database, apply this migration with
`npm run db:migrate:deploy`, and start the matching application build. Old and new
application versions cannot share this schema during a rolling deployment. Use
Prisma migrations, not `db push`. The matching application build validates one
attachment destination, matching course/lesson links, and exclusive managed versus
legacy metadata before attachment creates and updates.

The metadata preflight deliberately fails if existing managed attachment metadata
differs from `StoredFile`. Resolve the disagreement before retrying. Conflicting
attachment IDs, reused stored files, or invalid destinations also abort copying;
no records are silently discarded. All source tables remain until every copy
succeeds. MySQL DDL is not transactional: a failure after table creation can leave
a partially populated `Attachment` table. Inspect the failure and restore the
backup or remove only the new table after verifying all source tables remain,
then resolve the failed Prisma migration before retrying.

Deleting an attachment's parent removes its attachment row while retaining the
stored file for queued cleanup. Deleting a stored file removes its attachment row,
including report attachments, so unavailable metadata is not left behind.

## Scope

Grades and submissions remain separate because grades can exist without submitted
work. Course progress's course reference and calendar projection fields are retained
for their existing query/scheduling roles. OAuth image fields and uploaded profile
images also retain their separate behavior. This change does not flatten unrelated
models merely to lower the count.
