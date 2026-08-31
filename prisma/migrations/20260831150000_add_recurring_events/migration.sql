-- Recurrence belongs to the active Event calendar rather than the unused parallel Schedule system.
ALTER TABLE `Event`
    ADD COLUMN `recurrencePattern` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NULL;

DROP TABLE `Schedule`;
