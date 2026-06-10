import { generateSecret, generateURI, verifySync } from "otplib"
import { createHash, randomBytes } from "crypto"
import { AUTH } from "@/lib/constants"
import { encrypt, decrypt } from "@/lib/encryption"

export const totpService = {
  generateSecret(): { secret: string; encryptedSecret: string; uri: string; qrCodeUrl: string } {
    const secret = generateSecret()
    const encryptedSecret = encrypt(secret)
    const uri = generateURI({
      issuer: AUTH.TOTP_ISSUER,
      label: "QR Studio",
      secret,
    })
    return { secret, encryptedSecret, uri, qrCodeUrl: uri }
  },

  verifyToken(token: string, encryptedSecret: string): boolean {
    try {
      const secret = decrypt(encryptedSecret)
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
