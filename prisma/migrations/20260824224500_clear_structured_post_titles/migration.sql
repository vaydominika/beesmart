UPDATE `ClassroomPost`
SET `title` = NULL
WHERE `assignmentId` IS NOT NULL
   OR `testId` IS NOT NULL;
