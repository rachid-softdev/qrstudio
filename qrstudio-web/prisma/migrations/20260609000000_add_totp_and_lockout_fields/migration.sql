-- Add login lockout and TOTP fields to User model
-- loginAttempts: tracks consecutive failed logins for brute-force protection
-- lockoutUntil: timestamp when the account lockout expires
-- totpSecret: TOTP shared secret (encrypted at rest by application layer)
-- totpEnabled: whether TOTP two-factor authentication is active
-- totpBackupCodes: JSON array of hashed backup codes for account recovery
-- totpVerifiedAt: timestamp of last successful TOTP verification

ALTER TABLE "User" ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockoutUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpBackupCodes" JSONB;
ALTER TABLE "User" ADD COLUMN "totpVerifiedAt" TIMESTAMP(3);

-- Index for lockout queries (used in checkLockout)
CREATE INDEX "User_lockoutUntil_idx" ON "User"("lockoutUntil");
