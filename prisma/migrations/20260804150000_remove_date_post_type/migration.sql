-- Date posts had no creation flow; preserve any legacy records as regular text posts.
UPDATE `ClassroomPost` SET `type` = 'TEXT' WHERE `type` = 'DATE';

ALTER TABLE `ClassroomPost`
  MODIFY `type` ENUM('TEXT', 'PHOTO', 'ASSIGNMENT', 'TEST', 'COURSE', 'MATERIAL') NOT NULL;
