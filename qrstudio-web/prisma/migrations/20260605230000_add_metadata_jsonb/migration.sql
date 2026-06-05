-- Add JSONB metadata column (Phase 1 — additive, zero-downtime)
ALTER TABLE "QRCode" ADD COLUMN "metadata" JSONB;

-- Backfill existing rows: convert flat columns to JSONB
UPDATE "QRCode"
SET "metadata" =
  CASE "type"
    WHEN 'URL' THEN
      jsonb_build_object('destinationUrl', "destinationUrl")
    WHEN 'WHATSAPP' THEN
      jsonb_build_object('destinationUrl', "destinationUrl")
    WHEN 'PDF' THEN
      jsonb_build_object('destinationUrl', "destinationUrl")
    WHEN 'WIFI' THEN
      jsonb_build_object(
        'wifi', jsonb_build_object(
          'ssid', "wifiSsid",
          'password', "wifiPassword",
          'encryption', COALESCE("wifiEncryption", 'nopass')
        )
      )
    WHEN 'VCARD' THEN
      CASE WHEN "vcardJson" IS NOT NULL THEN
        jsonb_build_object('vcard', "vcardJson"::jsonb)
      ELSE
        '{}'::jsonb
      END
    WHEN 'TEXT' THEN
      jsonb_build_object('textContent', "textContent")
    ELSE
      '{}'::jsonb
  END;

-- Verify no rows have null metadata for types that should have data
-- (URL/WHATSAPP/PDF should always have destinationUrl)
-- Run manually: SELECT COUNT(*) FROM "QRCode" WHERE "type" IN ('URL','WHATSAPP','PDF') AND ("metadata" IS NULL OR "metadata"->>'destinationUrl' IS NULL);
