import { describe, it, expect, vi, beforeEach } from "vitest"

describe("encryption", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.TOTP_ENCRYPTION_KEY = "a".repeat(64) // 32 bytes hex
  })

  describe("encrypt", () => {
    it("returns a colon-delimited string with 3 parts (iv:ciphertext:authTag)", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const result = encrypt("JBSWY3DPEHPK3PXP")
      const parts = result.split(":")
      expect(parts).toHaveLength(3)
      // Each part should be valid base64 (non-empty, no whitespace)
      parts.forEach((part) => {
        expect(part).toMatch(/^[A-Za-z0-9+/=]+$/)
      })
    })

    it("produces different ciphertext for same plaintext (random IV)", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const plaintext = "JBSWY3DPEHPK3PXP"
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)
      expect(encrypted1).not.toBe(encrypted2)
      // Different IVs (first part) should differ
      const iv1 = encrypted1.split(":")[0]
      const iv2 = encrypted2.split(":")[0]
      expect(iv1).not.toBe(iv2)
    })

    it("encrypts empty string", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const result = encrypt("")
      const parts = result.split(":")
      expect(parts).toHaveLength(3)
    })

    it("encrypts unicode characters", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const result = encrypt("héllo wörld 🌍")
      expect(result.split(":")).toHaveLength(3)
    })

    it("throws a descriptive error when TOTP_ENCRYPTION_KEY is missing", async () => {
      delete process.env.TOTP_ENCRYPTION_KEY
      const { encrypt } = await import("@/lib/encryption")
      expect(() => encrypt("test")).toThrow(/TOTP_ENCRYPTION_KEY/)
    })

    it("throws when TOTP_ENCRYPTION_KEY is empty string", async () => {
      process.env.TOTP_ENCRYPTION_KEY = ""
      const { encrypt } = await import("@/lib/encryption")
      expect(() => encrypt("test")).toThrow(/TOTP_ENCRYPTION_KEY/)
    })

    it("throws when TOTP_ENCRYPTION_KEY is not valid hex", async () => {
      process.env.TOTP_ENCRYPTION_KEY = "not-hex-string!!!!"
      const { encrypt } = await import("@/lib/encryption")
      // Buffer.from(..., 'hex') ignores invalid chars but will produce wrong-length key
      // aes-256-gcm expects 32 bytes (64 hex chars). Our key is 17 chars → too short
      expect(() => encrypt("test")).toThrow()
    })
  })

  describe("decrypt", () => {
    it("round-trips encrypt then decrypt", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const plaintext = "JBSWY3DPEHPK3PXP"
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it("round-trips empty string", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("")
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe("")
    })

    it("round-trips unicode text", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const plaintext = "héllo wörld 🌍"
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it("round-trips a long string (1024 characters)", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const plaintext = "A".repeat(1024)
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it("handles legacy plaintext (backward compat)", async () => {
      const { decrypt } = await import("@/lib/encryption")
      const legacy = "JBSWY3DPEHPK3PXP"
      expect(decrypt(legacy)).toBe(legacy)
    })

    it("handles empty legacy string", async () => {
      const { decrypt } = await import("@/lib/encryption")
      expect(decrypt("")).toBe("")
    })

    it("handles legacy string with 2 colons but not 3-part format", async () => {
      const { decrypt } = await import("@/lib/encryption")
      // A string with 2 colons = 3 parts → would be treated as encrypted
      // But if it's not valid base64 + ciphertext, it will throw
      const legacy = "part1:part2:part3"
      expect(() => decrypt(legacy)).toThrow()
    })

    it("handles legacy string with 1 colon (2 parts)", async () => {
      const { decrypt } = await import("@/lib/encryption")
      const legacy = "part1:part2" // only 2 parts → legacy
      expect(decrypt(legacy)).toBe(legacy)
    })

    it("throws on tampered ciphertext (corrupted auth tag)", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("secret")
      const [iv, ct] = encrypted.split(":")
      // Replace the auth tag with a fake one (16 zero bytes encoded as base64)
      const fakeTag = Buffer.alloc(16).toString("base64")
      const tampered = `${iv}:${ct}:${fakeTag}`
      expect(() => decrypt(tampered)).toThrow()
    })

    it("throws on tampered ciphertext (corrupted IV)", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("secret")
      const [iv, ct, tag] = encrypted.split(":")
      const tampered = `${iv.slice(0, -1)}x:${ct}:${tag}`
      expect(() => decrypt(tampered)).toThrow()
    })

    it("throws on tampered ciphertext (corrupted ciphertext)", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("secret")
      const [iv, ct, tag] = encrypted.split(":")
      const tampered = `${iv}:${ct.slice(0, -1)}x:${tag}`
      expect(() => decrypt(tampered)).toThrow()
    })

    it("throws when TOTP_ENCRYPTION_KEY is missing on decrypt", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("test")
      delete process.env.TOTP_ENCRYPTION_KEY
      const { decrypt } = await import("@/lib/encryption")
      expect(() => decrypt(encrypted)).toThrow(/TOTP_ENCRYPTION_KEY/)
    })

    it("throws when decrypting with a different key", async () => {
      const { encrypt } = await import("@/lib/encryption")
      const encrypted = encrypt("secret")

      process.env.TOTP_ENCRYPTION_KEY = "b".repeat(64) // different key
      const { decrypt } = await import("@/lib/encryption")
      // Auth tag will not match with wrong key
      expect(() => decrypt(encrypted)).toThrow()
    })
  })

  describe("combined encrypt/decrypt", () => {
    it("decrypt(encrypt(x)) === x for various inputs", async () => {
      const { encrypt, decrypt } = await import("@/lib/encryption")
      const inputs = [
        "hello",
        "HELLO123!@#$%^&*()",
        "a",
        " ",
        "\t",
        "a\nb",
        "0000000000",
        JSON.stringify({ nested: { object: true } }),
      ]
      for (const input of inputs) {
        const encrypted = encrypt(input)
        const decrypted = decrypt(encrypted)
        expect(decrypted).toBe(input)
      }
    })
  })
})
