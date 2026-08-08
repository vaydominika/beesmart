-- Canonical assignment deadlines. Existing wall-clock values are interpreted
-- in Europe/Budapest, matching the application's legacy deployment timezone.
ALTER TABLE `AssignedWork`
  ADD COLUMN `deadlineAt` DATETIME(3) NULL,
  ADD COLUMN `deadlineTimeZone` VARCHAR(191) NOT NULL DEFAULT 'Europe/Budapest',
  ADD COLUMN `deadlineHasTime` BOOLEAN NOT NULL DEFAULT false;

UPDATE `AssignedWork`
SET
  `deadlineAt` = COALESCE(
    CONVERT_TZ(
      CONCAT(
        DATE_FORMAT(`dueDate`, '%Y-%m-%d'),
        ' ',
        COALESCE(NULLIF(`dueTime`, ''), '23:59:59')
      ),
      'Europe/Budapest',
      '+00:00'
    ),
    DATE_SUB(
      TIMESTAMP(DATE(`dueDate`), COALESCE(NULLIF(`dueTime`, ''), '23:59:59')),
      INTERVAL (
        CASE
          WHEN (
            DATE(`dueDate`) > DATE_SUB(
              LAST_DAY(CONCAT(YEAR(`dueDate`), '-03-01')),
              INTERVAL MOD(WEEKDAY(LAST_DAY(CONCAT(YEAR(`dueDate`), '-03-01'))) + 1, 7) DAY
            )
            AND DATE(`dueDate`) < DATE_SUB(
              LAST_DAY(CONCAT(YEAR(`dueDate`), '-10-01')),
              INTERVAL MOD(WEEKDAY(LAST_DAY(CONCAT(YEAR(`dueDate`), '-10-01'))) + 1, 7) DAY
            )
          ) OR (
            DATE(`dueDate`) = DATE_SUB(
              LAST_DAY(CONCAT(YEAR(`dueDate`), '-03-01')),
              INTERVAL MOD(WEEKDAY(LAST_DAY(CONCAT(YEAR(`dueDate`), '-03-01'))) + 1, 7) DAY
            )
            AND COALESCE(NULLIF(`dueTime`, ''), '23:59:59') >= '03:00:00'
          ) OR (
            DATE(`dueDate`) = DATE_SUB(
              LAST_DAY(CONCAT(YEAR(`dueDate`), '-10-01')),
              INTERVAL MOD(WEEKDAY(LAST_DAY(CONCAT(YEAR(`dueDate`), '-10-01'))) + 1, 7) DAY
            )
            AND COALESCE(NULLIF(`dueTime`, ''), '23:59:59') < '03:00:00'
          ) THEN 2
          ELSE 1
        END
      ) HOUR
    )
  ),
  `deadlineHasTime` = (`dueTime` IS NOT NULL AND `dueTime` <> '');

ALTER TABLE `AssignedWork`
  MODIFY `deadlineAt` DATETIME(3) NOT NULL,
  DROP INDEX `AssignedWork_dueDate_idx`,
  DROP COLUMN `dueDate`,
  DROP COLUMN `dueTime`;

CREATE INDEX `AssignedWork_deadlineAt_idx` ON `AssignedWork`(`deadlineAt`);

-- Configurable attempt policy and deterministic attempt history.
ALTER TABLE `Test`
  ADD COLUMN `maxAttempts` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `TestAttempt`
  ADD COLUMN `attemptNumber` INTEGER NOT NULL DEFAULT 1;

-- Number historical attempts per learner/test in creation order.
UPDATE `TestAttempt` AS target
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `testId`, `userId`
      ORDER BY `startedAt`, `createdAt`, `id`
    ) AS `numberedAttempt`
  FROM `TestAttempt`
) AS numbered ON numbered.`id` = target.`id`
SET target.`attemptNumber` = numbered.`numberedAttempt`;

CREATE UNIQUE INDEX `TestAttempt_testId_userId_attemptNumber_key`
  ON `TestAttempt`(`testId`, `userId`, `attemptNumber`);

-- One durable draft/final response per question in an attempt.
-- Keep the newest historical duplicate before creating the unique index.
DELETE duplicateResponse
FROM `TestAttemptResponse` duplicateResponse
JOIN `TestAttemptResponse` keptResponse
  ON duplicateResponse.`attemptId` = keptResponse.`attemptId`
  AND duplicateResponse.`questionId` = keptResponse.`questionId`
  AND (
    duplicateResponse.`createdAt` < keptResponse.`createdAt`
    OR (
      duplicateResponse.`createdAt` = keptResponse.`createdAt`
      AND duplicateResponse.`id` < keptResponse.`id`
    )
  );

CREATE UNIQUE INDEX `TestAttemptResponse_attemptId_questionId_key`
  ON `TestAttemptResponse`(`attemptId`, `questionId`);
