-- Extend the existing private upload pipeline for ticket screenshots.
ALTER TABLE `StoredFile`
  MODIFY `purpose` ENUM(
    'COURSE_ATTACHMENT',
    'POST_ATTACHMENT',
    'SUBMISSION_ATTACHMENT',
    'COURSE_COVER',
    'TICKET_ATTACHMENT'
  ) NOT NULL;

-- Preserve existing reports while making the model usable for feedback tickets.
ALTER TABLE `Report`
  ADD COLUMN `type` ENUM(
    'COURSE_REPORT',
    'EARLY_ACCESS_FEEDBACK',
    'AUTOMATED_COURSE_FLAG'
  ) NOT NULL DEFAULT 'COURSE_REPORT';

UPDATE `Report`
SET `type` = 'AUTOMATED_COURSE_FLAG'
WHERE `reason` LIKE 'AI_FLAG:%';

ALTER TABLE `Report` DROP FOREIGN KEY `Report_courseId_fkey`;
ALTER TABLE `Report` MODIFY `courseId` VARCHAR(191) NULL;
ALTER TABLE `Report`
  ADD CONSTRAINT `Report_courseId_fkey`
  FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Use a transitional enum so every existing status can be mapped safely.
ALTER TABLE `Report`
  MODIFY `status` ENUM(
    'PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED',
    'OPEN', 'IN_PROGRESS', 'CLOSED'
  ) NOT NULL DEFAULT 'PENDING';

UPDATE `Report` SET `status` = 'OPEN' WHERE `status` = 'PENDING';
UPDATE `Report` SET `status` = 'IN_PROGRESS' WHERE `status` = 'REVIEWED';
UPDATE `Report` SET `status` = 'CLOSED' WHERE `status` = 'DISMISSED';

ALTER TABLE `Report`
  MODIFY `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
  NOT NULL DEFAULT 'OPEN';

CREATE TABLE `ReportAttachment` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `storedFileId` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `ReportAttachment_storedFileId_key`(`storedFileId`),
  INDEX `ReportAttachment_reportId_idx`(`reportId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReportAttachment`
  ADD CONSTRAINT `ReportAttachment_reportId_fkey`
  FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ReportAttachment`
  ADD CONSTRAINT `ReportAttachment_storedFileId_fkey`
  FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
