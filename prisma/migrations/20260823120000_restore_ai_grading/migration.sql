-- Keep grading usage separate from content-generation allowances.
ALTER TABLE `AiUsageQuota`
    MODIFY `category` ENUM('LESSON_CONTENT', 'SYLLABUS', 'TEST_EXAM', 'GRADING') NOT NULL;

-- Persist review-only AI drafts so batch grading can be resumed safely.
ALTER TABLE `TestAttemptResponse`
    ADD COLUMN `aiSuggestedPoints` DOUBLE NULL,
    ADD COLUMN `aiSuggestedFeedback` TEXT NULL,
    ADD COLUMN `aiSuggestedConfidence` VARCHAR(10) NULL,
    ADD COLUMN `aiSuggestedAt` DATETIME(3) NULL;
