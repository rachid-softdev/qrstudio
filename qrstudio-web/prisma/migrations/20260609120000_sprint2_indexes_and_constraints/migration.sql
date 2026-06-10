-- Sprint 2 - Phase 1: Database layer
-- Composite indexes, GIN trigram search, CHECK constraints

-- Drop standalone indexes replaced by composites
DROP INDEX IF EXISTS "QRCode_workspaceId_idx";
DROP INDEX IF EXISTS "QRCode_createdAt_idx";
DROP INDEX IF EXISTS "Scan_qrCodeId_idx";
DROP INDEX IF EXISTS "Scan_qrCodeId_ipHash_idx";

-- Create composite index: workspace-scoped queries sorted by creation date
-- NOTE: CONCURRENTLY is omitted because Prisma wraps migrations in a transaction.
-- In production, run these manually with CONCURRENTLY during off-peak, or accept
-- the brief ACCESS EXCLUSIVE lock (table is small for most tenants).
CREATE INDEX IF NOT EXISTS "QRCode_workspaceId_createdAt_idx"
  ON "QRCode" ("workspaceId", "createdAt" DESC);

-- Create composite index: scan queries filtered by QR code, sorted by time, with IP dedup
CREATE INDEX IF NOT EXISTS "Scan_qrCodeId_scannedAt_ipHash_idx"
  ON "Scan" ("qrCodeId", "scannedAt", "ipHash");

-- GIN trigram index for LIKE / ILIKE searches on QRCode name
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "QRCode_name_trgm_idx"
  ON "QRCode" USING gin ("name" gin_trgm_ops);

-- CHECK constraints for data integrity

-- 1. QRCode.moduleShape must be one of the known values
ALTER TABLE "QRCode"
  DROP CONSTRAINT IF EXISTS "ck_qrcode_module_shape";
ALTER TABLE "QRCode"
  ADD CONSTRAINT "ck_qrcode_module_shape"
  CHECK ("moduleShape" IN ('square', 'rounded', 'dots'));

-- 2. Account.type must be one of: oauth, email, credentials
ALTER TABLE "Account"
  DROP CONSTRAINT IF EXISTS "ck_account_type";
ALTER TABLE "Account"
  ADD CONSTRAINT "ck_account_type"
  CHECK ("type" IN ('oauth', 'email', 'credentials'));

-- 3. WorkspaceInvitation.expiresAt must be after createdAt
ALTER TABLE "WorkspaceInvitation"
  DROP CONSTRAINT IF EXISTS "ck_invitation_expires";
ALTER TABLE "WorkspaceInvitation"
  ADD CONSTRAINT "ck_invitation_expires"
  CHECK ("expiresAt" > "createdAt");
