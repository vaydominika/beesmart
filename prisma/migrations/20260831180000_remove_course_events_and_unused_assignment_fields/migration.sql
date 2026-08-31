-- Course-linked events never had an application workflow. Remove the records
-- rather than leaving ownerless calendar events behind after dropping courseId.
DELETE FROM `Event`
WHERE `courseId` IS NOT NULL;

ALTER TABLE `Event`
    DROP FOREIGN KEY `Event_courseId_fkey`,
    DROP INDEX `Event_courseId_idx`,
    DROP COLUMN `courseId`;

-- AssignedWork represents classroom assignments. Course/test links and global
-- completion state were unused; learner-specific state remains in Submission.
ALTER TABLE `AssignedWork`
    DROP FOREIGN KEY `AssignedWork_courseId_fkey`,
    DROP FOREIGN KEY `AssignedWork_testId_fkey`,
    DROP INDEX `AssignedWork_courseId_idx`,
    DROP COLUMN `courseId`,
    DROP COLUMN `testId`,
    DROP COLUMN `isCompleted`,
    DROP COLUMN `completedAt`;
