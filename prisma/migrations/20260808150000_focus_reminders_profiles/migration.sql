-- Focus sessions use explicit seconds and an idempotency key for client retries.
ALTER TABLE `FocusSession`
  CHANGE COLUMN `duration` `durationSeconds` INTEGER NOT NULL,
  ADD COLUMN `completionId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `FocusSession_completionId_key` ON `FocusSession`(`completionId`);

-- Reminder notification metadata. Legacy reminders remain valid with no timezone or alert.
ALTER TABLE `Reminder`
  ADD COLUMN `timeZone` VARCHAR(191) NULL,
  ADD COLUMN `dueAt` DATETIME(3) NULL,
  ADD COLUMN `notifyAt` DATETIME(3) NULL,
  ADD COLUMN `notificationProcessedAt` DATETIME(3) NULL;

CREATE INDEX `Reminder_notifyAt_idx` ON `Reminder`(`notifyAt`);
CREATE INDEX `Reminder_dueAt_idx` ON `Reminder`(`dueAt`);

-- Remove the unsupported email channel and rename classroom notification preferences.
ALTER TABLE `UserSettings`
  DROP COLUMN `emailNotifications`,
  CHANGE COLUMN `courseAlerts` `classroomNotifications` BOOLEAN NOT NULL DEFAULT true;

-- Public profiles are opt-in now that the setting has a user-facing effect.
UPDATE `UserSettings` SET `profileVisibility` = 'PRIVATE';

ALTER TABLE `UserSettings`
  MODIFY `profileVisibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE';
