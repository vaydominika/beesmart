-- Validate every data invariant before the first destructive DDL statement.
-- Each guard deliberately raises a duplicate-key error when unsafe legacy data
-- exists, leaving the migration unapplied and the original tables intact.
CREATE TEMPORARY TABLE `_TestAnswerMigrationGuard` (`id` INTEGER NOT NULL PRIMARY KEY);
INSERT INTO `_TestAnswerMigrationGuard` (`id`) VALUES (1);
INSERT INTO `_TestAnswerMigrationGuard` (`id`)
SELECT 1
FROM `TestAnswer`
WHERE `answerText` IS NOT NULL
  AND TRIM(`answerText`) <> ''
  AND (`isCorrect` IS NULL OR `isCorrect` = false)
LIMIT 1;
DROP TEMPORARY TABLE `_TestAnswerMigrationGuard`;

CREATE TEMPORARY TABLE `_CourseProgressMigrationGuard` (`id` INTEGER NOT NULL PRIMARY KEY);
INSERT INTO `_CourseProgressMigrationGuard` (`id`) VALUES (1);
INSERT INTO `_CourseProgressMigrationGuard` (`id`)
SELECT 1
FROM `CourseProgress` AS `progress`
INNER JOIN `CourseLesson` AS `lesson` ON `lesson`.`id` = `progress`.`lessonId`
INNER JOIN `CourseModule` AS `module` ON `module`.`id` = `lesson`.`moduleId`
WHERE `progress`.`courseId` <> `module`.`courseId`
LIMIT 1;
DROP TEMPORARY TABLE `_CourseProgressMigrationGuard`;

-- Backfill the classroom invariant from the canonical post/event links before
-- checking whether any legacy assessment or assignment remains ambiguous.
UPDATE `Test` AS `test`
INNER JOIN (
    SELECT `testId`, MIN(`classroomId`) AS `classroomId`
    FROM `ClassroomPost`
    WHERE `testId` IS NOT NULL
    GROUP BY `testId`
    HAVING COUNT(DISTINCT `classroomId`) = 1
) AS `post` ON `post`.`testId` = `test`.`id`
SET `test`.`classroomId` = `post`.`classroomId`
WHERE `test`.`classroomId` IS NULL;

UPDATE `Test` AS `test`
INNER JOIN `Event` AS `event` ON `event`.`testId` = `test`.`id`
SET `test`.`classroomId` = `event`.`classroomId`
WHERE `test`.`classroomId` IS NULL AND `event`.`classroomId` IS NOT NULL;

CREATE TEMPORARY TABLE `_TestClassroomMigrationGuard` (`id` INTEGER NOT NULL PRIMARY KEY);
INSERT INTO `_TestClassroomMigrationGuard` (`id`) VALUES (1);
INSERT INTO `_TestClassroomMigrationGuard` (`id`) SELECT 1 FROM `Test` WHERE `classroomId` IS NULL LIMIT 1;
DROP TEMPORARY TABLE `_TestClassroomMigrationGuard`;

UPDATE `AssignedWork` AS `work`
INNER JOIN (
    SELECT `assignmentId`, MIN(`classroomId`) AS `classroomId`
    FROM `ClassroomPost`
    WHERE `assignmentId` IS NOT NULL
    GROUP BY `assignmentId`
    HAVING COUNT(DISTINCT `classroomId`) = 1
) AS `post` ON `post`.`assignmentId` = `work`.`id`
SET `work`.`classroomId` = `post`.`classroomId`
WHERE `work`.`classroomId` IS NULL;

UPDATE `AssignedWork` AS `work`
INNER JOIN `Event` AS `event` ON `event`.`assignmentId` = `work`.`id`
SET `work`.`classroomId` = `event`.`classroomId`
WHERE `work`.`classroomId` IS NULL AND `event`.`classroomId` IS NOT NULL;

CREATE TEMPORARY TABLE `_AssignedWorkClassroomMigrationGuard` (`id` INTEGER NOT NULL PRIMARY KEY);
INSERT INTO `_AssignedWorkClassroomMigrationGuard` (`id`) VALUES (1);
INSERT INTO `_AssignedWorkClassroomMigrationGuard` (`id`) SELECT 1 FROM `AssignedWork` WHERE `classroomId` IS NULL LIMIT 1;
DROP TEMPORARY TABLE `_AssignedWorkClassroomMigrationGuard`;

-- Fold one-to-one preferences and cached streak state into User.
ALTER TABLE `User`
    ADD COLUMN `theme` VARCHAR(191) NOT NULL DEFAULT 'bee',
    ADD COLUMN `courseCreationTutorialCompleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `defaultActiveMinutes` INTEGER NOT NULL DEFAULT 45,
    ADD COLUMN `defaultBreakMinutes` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `defaultAutoBreak` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `reminderNotifications` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `classroomNotifications` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `profileVisibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE',
    ADD COLUMN `activitySharing` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `currentStreak` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `longestStreak` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastActivityDate` DATETIME(3) NULL;

UPDATE `User` AS `user`
INNER JOIN `UserSettings` AS `settings` ON `settings`.`userId` = `user`.`id`
SET
    `user`.`theme` = `settings`.`theme`,
    `user`.`courseCreationTutorialCompleted` = `settings`.`courseCreationTutorialCompleted`,
    `user`.`defaultActiveMinutes` = `settings`.`defaultActiveMinutes`,
    `user`.`defaultBreakMinutes` = `settings`.`defaultBreakMinutes`,
    `user`.`defaultAutoBreak` = `settings`.`defaultAutoBreak`,
    `user`.`reminderNotifications` = `settings`.`reminderNotifications`,
    `user`.`classroomNotifications` = `settings`.`classroomNotifications`,
    `user`.`profileVisibility` = `settings`.`profileVisibility`,
    `user`.`activitySharing` = `settings`.`activitySharing`;

UPDATE `User` AS `user`
INNER JOIN `Streak` AS `streak` ON `streak`.`userId` = `user`.`id`
SET
    `user`.`currentStreak` = `streak`.`currentStreak`,
    `user`.`longestStreak` = `streak`.`longestStreak`,
    `user`.`lastActivityDate` = `streak`.`lastActivityDate`;

DROP TABLE `UserSettings`;
DROP TABLE `Streak`;

-- Collapse accepted short/essay answers into the question.
ALTER TABLE `TestQuestion` ADD COLUMN `acceptedAnswers` JSON NULL;

UPDATE `TestQuestion` AS `question`
INNER JOIN (
    SELECT `questionId`, JSON_ARRAYAGG(`answerText`) AS `acceptedAnswers`
    FROM `TestAnswer`
    WHERE `answerText` IS NOT NULL AND TRIM(`answerText`) <> ''
    GROUP BY `questionId`
) AS `answers` ON `answers`.`questionId` = `question`.`id`
SET `question`.`acceptedAnswers` = `answers`.`acceptedAnswers`;

DROP TABLE `TestAnswer`;

-- Use Prisma's implicit many-to-many table while retaining every course/tag pair.
CREATE TABLE `_CourseTags` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,
    UNIQUE INDEX `_CourseTags_AB_unique`(`A`, `B`),
    INDEX `_CourseTags_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_CourseTags` (`A`, `B`)
SELECT `courseId`, `tagId` FROM `CourseTag`;

ALTER TABLE `_CourseTags`
    ADD CONSTRAINT `_CourseTags_A_fkey` FOREIGN KEY (`A`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `_CourseTags_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE `CourseTag`;

-- CourseProgress's course is derivable from lesson -> module -> course.
CREATE INDEX `CourseProgress_userId_lastAccessedAt_idx` ON `CourseProgress`(`userId`, `lastAccessedAt`);

ALTER TABLE `CourseProgress`
    DROP FOREIGN KEY `CourseProgress_courseId_fkey`,
    DROP INDEX `CourseProgress_userId_idx`,
    DROP INDEX `CourseProgress_courseId_idx`,
    DROP COLUMN `courseId`;

CREATE INDEX `Test_classroomId_idx` ON `Test`(`classroomId`);
-- InnoDB can automatically drop the implicit foreign-key index when the
-- explicit replacement above is created. The foreign-key constraint remains.
ALTER TABLE `Test`
    MODIFY `classroomId` VARCHAR(191) NOT NULL;

ALTER TABLE `AssignedWork` MODIFY `classroomId` VARCHAR(191) NOT NULL;

-- Reminder display data belongs to Event. Keep only delivery state and indexes
-- used by event cleanup and per-user due-notification polling.
CREATE INDEX `Reminder_userId_notificationProcessedAt_notifyAt_idx`
    ON `Reminder`(`userId`, `notificationProcessedAt`, `notifyAt`);

ALTER TABLE `Reminder`
    DROP INDEX `Reminder_userId_idx`,
    DROP INDEX `Reminder_date_idx`,
    DROP INDEX `Reminder_notifyAt_idx`,
    DROP INDEX `Reminder_dueAt_idx`,
    DROP COLUMN `task`,
    DROP COLUMN `date`,
    DROP COLUMN `time`,
    DROP COLUMN `timeZone`,
    DROP COLUMN `dueAt`;
