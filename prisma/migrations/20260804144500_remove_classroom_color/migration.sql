-- Classroom styling now uses the shared application accent.
UPDATE `Event` SET `color` = NULL WHERE `classroomId` IS NOT NULL;

ALTER TABLE `Classroom` DROP COLUMN `color`;
