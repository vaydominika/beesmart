-- AI essay grading now writes awarded points directly.
-- Remove the obsolete suggestion, feedback, confidence, and timestamp fields.
ALTER TABLE `TestAttemptResponse`
    DROP COLUMN `aiSuggestedPoints`,
    DROP COLUMN `aiSuggestedFeedback`,
    DROP COLUMN `aiSuggestedConfidence`,
    DROP COLUMN `aiSuggestedAt`;
