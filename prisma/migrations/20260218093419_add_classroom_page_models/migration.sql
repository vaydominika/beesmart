-- AlterTable
ALTER TABLE `Announcement` ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `isPinned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `priority` ENUM('INFO', 'IMPORTANT', 'WARNING', 'URGENT') NOT NULL DEFAULT 'INFO',
    ADD COLUMN `publishAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `AssignedWork` ADD COLUMN `isGraded` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `maxPoints` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Classroom` ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `subject` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Test` ADD COLUMN `classroomId` VARCHAR(191) NULL,
    ADD COLUMN `closesAt` DATETIME(3) NULL,
    ADD COLUMN `opensAt` DATETIME(3) NULL,
    MODIFY `courseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TestAttemptResponse` ADD COLUMN `teacherComment` TEXT NULL;

-- CreateTable
CREATE TABLE `ClassroomPost` (
    `id` VARCHAR(191) NOT NULL,
    `classroomId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'PHOTO', 'ASSIGNMENT', 'TEST', 'DATE', 'COURSE', 'MATERIAL') NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` TEXT NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `assignmentId` VARCHAR(191) NULL,
    `testId` VARCHAR(191) NULL,
    `courseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClassroomPost_classroomId_idx`(`classroomId`),
    INDEX `ClassroomPost_authorId_idx`(`authorId`),
    INDEX `ClassroomPost_type_idx`(`type`),
    INDEX `ClassroomPost_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostFile` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` ENUM('PDF', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER') NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostFile_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NULL,
    `submissionId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Comment_postId_idx`(`postId`),
    INDEX `Comment_submissionId_idx`(`submissionId`),
    INDEX `Comment_authorId_idx`(`authorId`),
    INDEX `Comment_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Submission` (
    `id` VARCHAR(191) NOT NULL,
    `assignedWorkId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `content` TEXT NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED') NOT NULL DEFAULT 'PENDING',
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Submission_assignedWorkId_idx`(`assignedWorkId`),
    INDEX `Submission_userId_idx`(`userId`),
    UNIQUE INDEX `Submission_assignedWorkId_userId_key`(`assignedWorkId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubmissionFile` (
    `id` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` ENUM('PDF', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER') NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SubmissionFile_submissionId_idx`(`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Test` ADD CONSTRAINT `Test_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomPost` ADD CONSTRAINT `ClassroomPost_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomPost` ADD CONSTRAINT `ClassroomPost_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomPost` ADD CONSTRAINT `ClassroomPost_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `AssignedWork`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomPost` ADD CONSTRAINT `ClassroomPost_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomPost` ADD CONSTRAINT `ClassroomPost_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostFile` ADD CONSTRAINT `PostFile_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ClassroomPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ClassroomPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_assignedWorkId_fkey` FOREIGN KEY (`assignedWorkId`) REFERENCES `AssignedWork`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionFile` ADD CONSTRAINT `SubmissionFile_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
