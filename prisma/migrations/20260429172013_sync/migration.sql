-- AlterTable
ALTER TABLE `course` ADD COLUMN `published` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `coursefile` ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `courselesson` ADD COLUMN `contentDraft` TEXT NULL,
    ADD COLUMN `isLocked` BOOLEAN NOT NULL DEFAULT false;
