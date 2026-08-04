-- Course visibility and access control
ALTER TABLE `Course`
  ADD COLUMN `visibility` ENUM('PRIVATE', 'PUBLIC', 'INVITATION_ONLY') NOT NULL DEFAULT 'PRIVATE';

UPDATE `Course` SET `visibility` = 'PUBLIC' WHERE `isPublic` = true;

CREATE TABLE `CourseAccess` (
  `id` VARCHAR(191) NOT NULL,
  `courseId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `invitedById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CourseAccess_courseId_userId_key` (`courseId`, `userId`),
  INDEX `CourseAccess_userId_idx` (`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ClassroomCourse` (
  `id` VARCHAR(191) NOT NULL,
  `classroomId` VARCHAR(191) NOT NULL,
  `courseId` VARCHAR(191) NOT NULL,
  `addedById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ClassroomCourse_classroomId_courseId_key` (`classroomId`, `courseId`),
  INDEX `ClassroomCourse_classroomId_idx` (`classroomId`),
  INDEX `ClassroomCourse_courseId_idx` (`courseId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Synchronized, protected Classroom calendar events
ALTER TABLE `Event`
  ADD COLUMN `testId` VARCHAR(191) NULL,
  ADD COLUMN `isProtected` BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX `Event_testId_key` ON `Event`(`testId`);
CREATE INDEX `Event_testId_idx` ON `Event`(`testId`);

-- Global notification center metadata
ALTER TABLE `Notification`
  ADD COLUMN `category` ENUM('GENERAL', 'CLASSROOM') NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN `classroomId` VARCHAR(191) NULL,
  ADD COLUMN `classroomName` VARCHAR(191) NULL,
  ADD COLUMN `actorId` VARCHAR(191) NULL,
  ADD COLUMN `actorName` VARCHAR(191) NULL,
  ADD COLUMN `actionUrl` VARCHAR(191) NULL;

CREATE INDEX `Notification_category_idx` ON `Notification`(`category`);
CREATE INDEX `Notification_classroomId_idx` ON `Notification`(`classroomId`);

-- Idempotent Bee Consistent activity ledger
CREATE TABLE `ActivityRecord` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('LEARNER', 'STUDENT', 'TEACHER') NOT NULL,
  `activityType` VARCHAR(191) NOT NULL,
  `courseId` VARCHAR(191) NULL,
  `classroomId` VARCHAR(191) NULL,
  `relatedId` VARCHAR(191) NULL,
  `dedupeKey` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ActivityRecord_dedupeKey_key` (`dedupeKey`),
  INDEX `ActivityRecord_userId_idx` (`userId`),
  INDEX `ActivityRecord_activityType_idx` (`activityType`),
  INDEX `ActivityRecord_classroomId_idx` (`classroomId`),
  INDEX `ActivityRecord_courseId_idx` (`courseId`),
  INDEX `ActivityRecord_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CourseAccess`
  ADD CONSTRAINT `CourseAccess_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CourseAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClassroomCourse`
  ADD CONSTRAINT `ClassroomCourse_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ClassroomCourse_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Event`
  ADD CONSTRAINT `Event_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `Test`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ActivityRecord`
  ADD CONSTRAINT `ActivityRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
