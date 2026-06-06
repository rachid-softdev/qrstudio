-- Add soft-delete column
ALTER TABLE "QRCode" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Add index for list + cleanup queries
CREATE INDEX "QRCode_workspaceId_deletedAt_idx" ON "QRCode"("workspaceId", "deletedAt");
