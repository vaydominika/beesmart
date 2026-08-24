-- Link assignment deadlines to their source records so calendar edits update the assignment itself.
ALTER TABLE `Event`
    ADD COLUMN `assignmentId` VARCHAR(191) NULL;

-- Backfill existing assignment events created by the classroom routes.
UPDATE `Event` AS `event`
INNER JOIN `AssignedWork` AS `assignment`
    ON `assignment`.`classroomId` = `event`.`classroomId`
    AND `event`.`title` = CONCAT('Assignment: ', `assignment`.`title`)
    AND ABS(TIMESTAMPDIFF(SECOND, `event`.`startDate`, `assignment`.`deadlineAt`)) < 60
SET
    `event`.`assignmentId` = `assignment`.`id`,
    `event`.`isProtected` = true
WHERE `event`.`assignmentId` IS NULL;

ALTER TABLE `Event`
    ADD UNIQUE INDEX `Event_assignmentId_key`(`assignmentId`),
    ADD INDEX `Event_assignmentId_idx`(`assignmentId`),
    ADD CONSTRAINT `Event_assignmentId_fkey`
        FOREIGN KEY (`assignmentId`) REFERENCES `AssignedWork`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE;
