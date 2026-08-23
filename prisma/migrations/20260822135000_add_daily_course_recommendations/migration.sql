-- Store one stable AI-selected course for each recommendation type and UTC day.
CREATE TABLE `DailyCourseRecommendation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `kind` ENUM('HIVE_PICK', 'TRY_SOMETHING_NEW') NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyCourseRecommendation_userId_kind_periodStart_key`(`userId`, `kind`, `periodStart`),
    INDEX `DailyCourseRecommendation_userId_periodStart_idx`(`userId`, `periodStart`),
    INDEX `DailyCourseRecommendation_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DailyCourseRecommendation`
    ADD CONSTRAINT `DailyCourseRecommendation_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `DailyCourseRecommendation_courseId_fkey`
    FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
