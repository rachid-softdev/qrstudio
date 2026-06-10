import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

function getEncryptionKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32"
    )
  }
  return Buffer.from(key, "hex")
}

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits
const TAG_LENGTH = 16 // 128 bits

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns colon-delimited base64: "iv:ciphertext:authTag"
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "base64")
  encrypted += cipher.final("base64")
  const authTag = cipher.getAuthTag().toString("base64")

  return `${iv.toString("base64")}:${encrypted}:${authTag}`
}

/**
 * Decrypts a string produced by encrypt().
 * Returns plaintext, or throws on tamper detection (auth tag mismatch).
 * Also handles legacy plaintext (not in encrypted format) for backward compatibility.
 */
export function decrypt(encrypted: string): string {
  // Backward compatibility: if not in "iv:ciphertext:authTag" format, return as-is
  if (!encrypted || encrypted.split(":").length !== 3) {
    return encrypted
  }

  const key = getEncryptionKey()
  const [ivB64, ciphertextB64, authTagB64] = encrypted.split(":")

  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertextB64, "base64", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}
