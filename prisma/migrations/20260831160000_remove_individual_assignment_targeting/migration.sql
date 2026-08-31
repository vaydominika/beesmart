-- Individually targeted assignments never had a complete learner workflow.
-- Remove any legacy targeted records instead of exposing them to the whole classroom.
DELETE FROM `ClassroomPost`
WHERE `assignmentId` IN (
    SELECT `id` FROM `AssignedWork` WHERE `assignedToId` IS NOT NULL
);

DELETE FROM `AssignedWork` WHERE `assignedToId` IS NOT NULL;

ALTER TABLE `AssignedWork`
    DROP FOREIGN KEY `AssignedWork_assignedToId_fkey`,
    DROP INDEX `AssignedWork_assignedToId_idx`,
    DROP COLUMN `assignedToId`;
