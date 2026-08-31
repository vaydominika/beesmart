-- Remove database-only learner features and the incomplete classroom invitation flow.
-- Child tables are dropped before their parents to satisfy foreign-key constraints.
DROP TABLE `FlashcardStudySession`;
DROP TABLE `Flashcard`;
DROP TABLE `FlashcardSet`;
DROP TABLE `Bookmark`;
DROP TABLE `Certificate`;
DROP TABLE `ClassroomInvitation`;
