-- Grades are persisted only for graded assignments.
-- Tests and exams keep their results in TestAttempt and TestAttemptResponse.
DELETE FROM `Grade` WHERE `assignedWorkId` IS NULL;

ALTER TABLE `Grade` DROP FOREIGN KEY `Grade_courseId_fkey`;
ALTER TABLE `Grade` DROP FOREIGN KEY `Grade_courseEnrollmentId_fkey`;
ALTER TABLE `Grade` DROP FOREIGN KEY `Grade_testAttemptId_fkey`;

ALTER TABLE `Grade`
    DROP INDEX `Grade_courseId_idx`,
    DROP INDEX `Grade_courseEnrollmentId_idx`,
    DROP INDEX `Grade_testAttemptId_idx`,
    DROP COLUMN `courseId`,
    DROP COLUMN `courseEnrollmentId`,
    DROP COLUMN `testAttemptId`,
    MODIFY `assignedWorkId` VARCHAR(191) NOT NULL;
