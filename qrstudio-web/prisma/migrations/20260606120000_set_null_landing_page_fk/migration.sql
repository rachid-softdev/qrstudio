-- Change FK from CASCADE to SetNull to prevent accidental deletion of QR codes
-- when a LandingPage is removed. The QR code remains active with landingPageId = NULL.
ALTER TABLE "QRCode" DROP CONSTRAINT "QRCode_landingPageId_fkey";
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
