-- Track independent daily AI generation allowances per user.
CREATE TABLE `AiUsageQuota` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `category` ENUM('LESSON_CONTENT', 'SYLLABUS', 'TEST_EXAM') NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiUsageQuota_userId_category_key`(`userId`, `category`),
    INDEX `AiUsageQuota_periodStart_idx`(`periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiUsageQuota`
    ADD CONSTRAINT `AiUsageQuota_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
