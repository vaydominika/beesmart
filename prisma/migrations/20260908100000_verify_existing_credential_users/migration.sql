-- Existing password accounts predate email verification and must retain access.
UPDATE `User`
SET `emailVerified` = CURRENT_TIMESTAMP(3)
WHERE `password` IS NOT NULL
  AND `emailVerified` IS NULL;
