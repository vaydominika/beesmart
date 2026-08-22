ALTER TABLE `StoredFile`
  MODIFY `purpose` ENUM(
    'COURSE_ATTACHMENT',
    'POST_ATTACHMENT',
    'SUBMISSION_ATTACHMENT',
    'COURSE_COVER',
    'TICKET_ATTACHMENT',
    'PROFILE_AVATAR',
    'PROFILE_BANNER'
  ) NOT NULL;

ALTER TABLE `User`
  ADD COLUMN `avatarFileId` VARCHAR(191) NULL,
  ADD COLUMN `bannerFileId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_avatarFileId_key` ON `User`(`avatarFileId`);
CREATE UNIQUE INDEX `User_bannerFileId_key` ON `User`(`bannerFileId`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_avatarFileId_fkey`
    FOREIGN KEY (`avatarFileId`) REFERENCES `StoredFile`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `User_bannerFileId_fkey`
    FOREIGN KEY (`bannerFileId`) REFERENCES `StoredFile`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `RateLimitBucket` (
  `key` VARCHAR(191) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `windowStart` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`key`),
  INDEX `RateLimitBucket_expiresAt_idx`(`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
