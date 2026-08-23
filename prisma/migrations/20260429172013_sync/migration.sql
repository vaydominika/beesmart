-- AlterTable
ALTER TABLE `Course` ADD COLUMN `published` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `CourseFile` ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `CourseLesson` ADD COLUMN `contentDraft` TEXT NULL,
    ADD COLUMN `isLocked` BOOLEAN NOT NULL DEFAULT false;
