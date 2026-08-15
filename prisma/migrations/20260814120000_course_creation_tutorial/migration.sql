-- Course creation is unlocked after the account completes the builder tutorial.
ALTER TABLE `UserSettings`
    ADD COLUMN `courseCreationTutorialCompleted` BOOLEAN NOT NULL DEFAULT false;
