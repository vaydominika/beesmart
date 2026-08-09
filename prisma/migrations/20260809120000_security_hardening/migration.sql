CREATE TABLE `StoredFile` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `purpose` ENUM('COURSE_ATTACHMENT', 'POST_ATTACHMENT', 'SUBMISSION_ATTACHMENT', 'COURSE_COVER') NOT NULL,
  `storageKey` VARCHAR(191) NOT NULL,
  `originalName` VARCHAR(191) NOT NULL,
  `detectedMime` VARCHAR(191) NOT NULL,
  `fileType` ENUM('PDF', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER') NOT NULL,
  `size` INTEGER NOT NULL,
  `checksum` VARCHAR(191) NOT NULL,
  `scanStatus` ENUM('NOT_REQUIRED', 'CLEAN', 'INFECTED', 'ERROR') NOT NULL,
  `state` ENUM('PENDING', 'ATTACHED', 'DELETE_PENDING') NOT NULL DEFAULT 'PENDING',
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `StoredFile_storageKey_key`(`storageKey`),
  INDEX `StoredFile_ownerId_idx`(`ownerId`),
  INDEX `StoredFile_state_expiresAt_idx`(`state`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Course`
  ADD COLUMN `coverStoredFileId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Course_coverStoredFileId_key`(`coverStoredFileId`);

ALTER TABLE `CourseFile`
  MODIFY `fileUrl` VARCHAR(191) NULL,
  ADD COLUMN `storedFileId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `CourseFile_storedFileId_key`(`storedFileId`);

ALTER TABLE `PostFile`
  MODIFY `fileUrl` VARCHAR(191) NULL,
  ADD COLUMN `storedFileId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `PostFile_storedFileId_key`(`storedFileId`);

ALTER TABLE `SubmissionFile`
  MODIFY `fileUrl` VARCHAR(191) NULL,
  ADD COLUMN `storedFileId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `SubmissionFile_storedFileId_key`(`storedFileId`);

ALTER TABLE `StoredFile`
  ADD CONSTRAINT `StoredFile_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Course`
  ADD CONSTRAINT `Course_coverStoredFileId_fkey` FOREIGN KEY (`coverStoredFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CourseFile`
  ADD CONSTRAINT `CourseFile_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PostFile`
  ADD CONSTRAINT `PostFile_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SubmissionFile`
  ADD CONSTRAINT `SubmissionFile_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
