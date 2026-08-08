-- Reminders are personal notification settings for events, never standalone tasks.
DELETE FROM `Reminder` WHERE `eventId` IS NULL;

ALTER TABLE `Reminder`
  DROP FOREIGN KEY `Reminder_eventId_fkey`,
  DROP FOREIGN KEY `Reminder_assignedWorkId_fkey`,
  DROP INDEX `Reminder_assignedWorkId_idx`,
  DROP COLUMN `assignedWorkId`,
  MODIFY `eventId` VARCHAR(191) NOT NULL;

ALTER TABLE `Reminder`
  ADD CONSTRAINT `Reminder_eventId_fkey`
    FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX `Reminder_userId_eventId_key` ON `Reminder`(`userId`, `eventId`);
