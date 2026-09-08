-- Consolidate attachments while preserving IDs and legacy uploads.
-- Run with application writes stopped. Source tables are only dropped after all
-- copies and new foreign keys succeed. visibility is the authoritative setting.
-- Fail before changing permanent tables if managed metadata has diverged.
CREATE TEMPORARY TABLE `attachment_metadata_must_match` (`ok` INTEGER NOT NULL PRIMARY KEY);
INSERT INTO `attachment_metadata_must_match` VALUES (1);
INSERT INTO `attachment_metadata_must_match` (`ok`)
SELECT 1 FROM (
  SELECT `storedFileId`, `fileName`, `fileType`, `fileSize` FROM `CourseFile`
  UNION ALL SELECT `storedFileId`, `fileName`, `fileType`, `fileSize` FROM `PostFile`
  UNION ALL SELECT `storedFileId`, `fileName`, `fileType`, `fileSize` FROM `SubmissionFile`
) AS old_file JOIN `StoredFile` s ON s.`id` = old_file.`storedFileId`
WHERE BINARY old_file.`fileName` <> BINARY s.`originalName`
   OR old_file.`fileType` <> s.`fileType` OR old_file.`fileSize` <> s.`size`
LIMIT 1;
DROP TEMPORARY TABLE `attachment_metadata_must_match`;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `lessonId` VARCHAR(191) NULL,
    `postId` VARCHAR(191) NULL,
    `submissionId` VARCHAR(191) NULL,
    `reportId` VARCHAR(191) NULL,
    `storedFileId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `legacyFileName` VARCHAR(191) NULL,
    `legacyFileUrl` VARCHAR(191) NULL,
    `legacyFileType` ENUM('PDF', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER') NULL,
    `legacyFileSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Attachment_storedFileId_key`(`storedFileId`),
    INDEX `Attachment_courseId_idx`(`courseId`),
    INDEX `Attachment_lessonId_idx`(`lessonId`),
    INDEX `Attachment_postId_idx`(`postId`),
    INDEX `Attachment_submissionId_idx`(`submissionId`),
    INDEX `Attachment_reportId_idx`(`reportId`),
    INDEX `Attachment_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `CourseLesson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ClassroomPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `Attachment` (`id`,`courseId`,`lessonId`,`uploadedById`,`isVisible`,`storedFileId`,`createdAt`,`legacyFileName`,`legacyFileUrl`,`legacyFileType`,`legacyFileSize`)
SELECT f.`id`,f.`courseId`,f.`lessonId`,f.`uploadedById`,f.`isVisible`,f.`storedFileId`,f.`createdAt`,
  IF(f.`storedFileId` IS NULL,f.`fileName`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileUrl`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileType`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileSize`,NULL)
FROM `CourseFile` f;

INSERT INTO `Attachment` (`id`,`postId`,`storedFileId`,`createdAt`,`legacyFileName`,`legacyFileUrl`,`legacyFileType`,`legacyFileSize`)
SELECT f.`id`,f.`postId`,f.`storedFileId`,f.`createdAt`,
  IF(f.`storedFileId` IS NULL,f.`fileName`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileUrl`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileType`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileSize`,NULL)
FROM `PostFile` f;

INSERT INTO `Attachment` (`id`,`submissionId`,`storedFileId`,`createdAt`,`legacyFileName`,`legacyFileUrl`,`legacyFileType`,`legacyFileSize`)
SELECT f.`id`,f.`submissionId`,f.`storedFileId`,f.`createdAt`,
  IF(f.`storedFileId` IS NULL,f.`fileName`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileUrl`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileType`,NULL),
  IF(f.`storedFileId` IS NULL,f.`fileSize`,NULL)
FROM `SubmissionFile` f;

INSERT INTO `Attachment` (`id`,`reportId`,`storedFileId`,`createdAt`)
SELECT a.`id`,a.`reportId`,a.`storedFileId`,s.`createdAt`
FROM `ReportAttachment` a JOIN `StoredFile` s ON s.`id` = a.`storedFileId`;

-- Colliding IDs or storedFileIds deliberately abort the inserts above; never
-- discard one attachment to make the migration pass.
DROP TABLE `CourseFile`;
DROP TABLE `PostFile`;
DROP TABLE `SubmissionFile`;
DROP TABLE `ReportAttachment`;

ALTER TABLE `Course` DROP COLUMN `isPublic`;
DROP INDEX `User_email_idx` ON `User`;
DROP INDEX `Classroom_code_idx` ON `Classroom`;
DROP INDEX `Tag_slug_idx` ON `Tag`;
DROP INDEX `Streak_userId_idx` ON `Streak`;
DROP INDEX `UserSettings_userId_idx` ON `UserSettings`;
DROP INDEX `Event_testId_idx` ON `Event`;
DROP INDEX `Event_assignmentId_idx` ON `Event`;
