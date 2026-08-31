-- Preserve legacy single-classroom course links in the canonical join table.
INSERT IGNORE INTO `ClassroomCourse` (`id`, `classroomId`, `courseId`, `addedById`, `createdAt`)
SELECT
    CONCAT('cc_', LEFT(SHA2(CONCAT(`id`, ':', `classroomId`), 256), 32)),
    `classroomId`,
    `id`,
    `createdById`,
    `createdAt`
FROM `Course`
WHERE `classroomId` IS NOT NULL;

ALTER TABLE `Course`
    DROP FOREIGN KEY `Course_classroomId_fkey`,
    DROP INDEX `Course_classroomId_idx`,
    DROP COLUMN `classroomId`;

-- Event locations never had an application workflow.
ALTER TABLE `Event`
    DROP COLUMN `location`;

-- Reminder delivery is tracked exclusively by notificationProcessedAt.
ALTER TABLE `Reminder`
    DROP COLUMN `completed`;

-- RETURNED had no return-for-revision workflow. Preserve those submissions as submitted.
UPDATE `Submission`
SET `status` = 'SUBMITTED'
WHERE `status` = 'RETURNED';

ALTER TABLE `Submission`
    MODIFY `status` ENUM('PENDING', 'SUBMITTED', 'LATE', 'GRADED') NOT NULL DEFAULT 'PENDING';
