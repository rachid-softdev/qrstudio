import { generateSecret, generateURI, verifySync } from "otplib"
import { createHash, randomBytes } from "crypto"

const TOTP_ISSUER = "QR Studio"

export const totpService = {
  generateSecret(): { secret: string; uri: string; qrCodeUrl: string } {
    const secret = generateSecret()
    const uri = generateURI({
      issuer: TOTP_ISSUER,
      label: "QR Studio",
      secret,
    })
    return { secret, uri, qrCodeUrl: uri }
  },

  verifyToken(token: string, secret: string): boolean {
    try {
      const result = verifySync({ secret, token })
      return result.valid
    } catch {
      return false
    }
  },

  generateBackupCodes(count: number = 8): { plain: string[]; hashed: string[] } {
    const plain: string[] = []
    const hashed: string[] = []
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString("hex").toUpperCase().slice(0, 8)
      plain.push(code)
      hashed.push(createHash("sha256").update(code).digest("hex"))
    }
    return { plain, hashed }
  },

  verifyBackupCode(
    code: string,
    backupCodes: { code_hash: string; used: boolean }[]
  ): number {
    const hash = createHash("sha256").update(code).digest("hex")
    return backupCodes.findIndex((b) => b.code_hash === hash && !b.used)
  },
}
