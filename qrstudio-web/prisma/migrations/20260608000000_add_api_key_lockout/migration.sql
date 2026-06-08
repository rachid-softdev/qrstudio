-- Add failedAttempts and lockedUntil to ApiKey model for brute-force protection
-- 10 consecutive failures ? 15 minute lockout

ALTER TABLE "ApiKey" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ApiKey" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Index for lockout queries (used in validate())
CREATE INDEX "ApiKey_failedAttempts_idx" ON "ApiKey"("failedAttempts");
