-- CreateTable
CREATE TABLE "ScanDaily" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalScans" INTEGER NOT NULL DEFAULT 0,
    "uniqueIps" INTEGER NOT NULL DEFAULT 0,
    "byCountry" JSONB,
    "byDevice" JSONB,
    "byOs" JSONB,
    "byBrowser" JSONB,

    CONSTRAINT "ScanDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregationWatermark" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "lastProcessedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregationWatermark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanDaily_qrCodeId_date_key" ON "ScanDaily"("qrCodeId", "date");

-- CreateIndex
CREATE INDEX "ScanDaily_qrCodeId_date_idx" ON "ScanDaily"("qrCodeId", "date");

-- CreateIndex
CREATE INDEX "ScanDaily_date_idx" ON "ScanDaily"("date");

-- CreateIndex
CREATE INDEX "ScanDaily_qrCodeId_idx" ON "ScanDaily"("qrCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregationWatermark_queueName_key" ON "AggregationWatermark"("queueName");

-- AddForeignKey
ALTER TABLE "ScanDaily" ADD CONSTRAINT "ScanDaily_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
