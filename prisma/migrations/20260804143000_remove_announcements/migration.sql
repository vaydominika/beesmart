-- Remove the standalone announcement feature and preserve existing notifications as generic items.
UPDATE `Notification`
SET `type` = 'OTHER'
WHERE `type` = 'ANNOUNCEMENT';

ALTER TABLE `Notification`
  MODIFY `type` ENUM('ASSIGNMENT', 'REMINDER', 'EVENT', 'GRADE', 'INVITATION', 'OTHER') NOT NULL;

DROP TABLE `Announcement`;
