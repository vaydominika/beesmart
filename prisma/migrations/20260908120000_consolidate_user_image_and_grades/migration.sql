-- Use Auth.js's canonical image column as the single user profile-image URL.
-- A user-uploaded BeeSmart avatar takes precedence over an OAuth image.
UPDATE `User`
SET `image` = COALESCE(NULLIF(TRIM(`avatar`), ''), `image`)
WHERE `avatar` IS NOT NULL;

ALTER TABLE `User` DROP COLUMN `avatar`;

ALTER TABLE `User` DROP FOREIGN KEY `User_avatarFileId_fkey`;
ALTER TABLE `User` DROP INDEX `User_avatarFileId_key`;
ALTER TABLE `User` RENAME COLUMN `avatarFileId` TO `imageFileId`;
CREATE UNIQUE INDEX `User_imageFileId_key` ON `User`(`imageFileId`);
ALTER TABLE `User`
ADD CONSTRAINT `User_imageFileId_fkey`
FOREIGN KEY (`imageFileId`) REFERENCES `StoredFile`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- Retain the most recently updated grade if historical duplicates exist.
DELETE older
FROM `Grade` AS older
JOIN `Grade` AS newer
  ON older.`userId` = newer.`userId`
 AND older.`assignedWorkId` = newer.`assignedWorkId`
 AND (
      older.`updatedAt` < newer.`updatedAt`
      OR (older.`updatedAt` = newer.`updatedAt` AND older.`id` < newer.`id`)
 );

CREATE UNIQUE INDEX `Grade_userId_assignedWorkId_key`
ON `Grade`(`userId`, `assignedWorkId`);
DROP INDEX `Grade_userId_idx` ON `Grade`;

-- submittedAt is the authoritative completion state for test attempts.
UPDATE `TestAttempt`
SET `submittedAt` = COALESCE(`submittedAt`, `updatedAt`)
WHERE `isCompleted` = TRUE;

ALTER TABLE `TestAttempt` DROP COLUMN `isCompleted`;
