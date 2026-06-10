-- CreateTable
CREATE TABLE "WorkspaceQRStats" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "totalQRCount" INTEGER NOT NULL DEFAULT 0,
    "activeCount" INTEGER NOT NULL DEFAULT 0,
    "pausedCount" INTEGER NOT NULL DEFAULT 0,
    "urlCount" INTEGER NOT NULL DEFAULT 0,
    "landingCount" INTEGER NOT NULL DEFAULT 0,
    "otherCount" INTEGER NOT NULL DEFAULT 0,
    "totalScans" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceQRStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceQRStats_workspaceId_key" ON "WorkspaceQRStats"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceQRStats" ADD CONSTRAINT "WorkspaceQRStats_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one-time upsert from existing data
INSERT INTO "WorkspaceQRStats" ("id", "workspaceId", "totalQRCount", "activeCount", "pausedCount", "urlCount", "landingCount", "otherCount", "totalScans", "updatedAt")
SELECT
  gen_random_uuid()::text,
  w."id",
  COALESCE(q.total_qr, 0),
  COALESCE(q.active_qr, 0),
  COALESCE(q.paused_qr, 0),
  COALESCE(q.url_qr, 0),
  COALESCE(q.landing_qr, 0),
  COALESCE(q.other_qr, 0),
  COALESCE(s.total_scans, 0),
  NOW()
FROM "Workspace" w
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total_qr,
    COUNT(*) FILTER (WHERE "status" = 'ACTIVE')::int AS active_qr,
    COUNT(*) FILTER (WHERE "status" = 'PAUSED')::int AS paused_qr,
    COUNT(*) FILTER (WHERE "type" = 'URL')::int AS url_qr,
    COUNT(*) FILTER (WHERE "type" = 'LANDING_PAGE')::int AS landing_qr,
    COUNT(*) FILTER (WHERE "type" NOT IN ('URL', 'LANDING_PAGE'))::int AS other_qr
  FROM "QRCode"
  WHERE "workspaceId" = w."id" AND "deletedAt" IS NULL
) q ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM("totalScans"), 0)::int AS total_scans
  FROM "QRCode"
  WHERE "workspaceId" = w."id" AND "deletedAt" IS NULL
) s ON true
ON CONFLICT ("workspaceId") DO UPDATE SET
  "totalQRCount" = EXCLUDED."totalQRCount",
  "activeCount" = EXCLUDED."activeCount",
  "pausedCount" = EXCLUDED."pausedCount",
  "urlCount" = EXCLUDED."urlCount",
  "landingCount" = EXCLUDED."landingCount",
  "otherCount" = EXCLUDED."otherCount",
  "totalScans" = EXCLUDED."totalScans",
  "updatedAt" = EXCLUDED."updatedAt";
