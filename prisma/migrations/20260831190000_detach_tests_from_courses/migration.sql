-- Courses are content sources only. Classroom tests and exams must remain
-- independent after being generated from course text.
ALTER TABLE `Test`
    DROP FOREIGN KEY `Test_courseId_fkey`,
    DROP FOREIGN KEY `Test_lessonId_fkey`,
    DROP INDEX `Test_courseId_idx`,
    DROP INDEX `Test_lessonId_idx`,
    DROP COLUMN `courseId`,
    DROP COLUMN `lessonId`;
