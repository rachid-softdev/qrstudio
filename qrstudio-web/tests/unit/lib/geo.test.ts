import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCountry } from "@/lib/geo"

describe("getCountry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return null for localhost IPv4", async () => {
    const result = await getCountry("127.0.0.1")
    expect(result).toBeNull()
  })

  it("should return null for localhost IPv6", async () => {
    const result = await getCountry("::1")
    expect(result).toBeNull()
  })

  it("should return null for 'unknown' IP", async () => {
    const result = await getCountry("unknown")
    expect(result).toBeNull()
  })

  it("should return null for empty string", async () => {
    const result = await getCountry("")
    expect(result).toBeNull()
  })

  it("should return null for falsy IP", async () => {
    const result = await getCountry("")
    expect(result).toBeNull()
  })

  it("should return null when no GeoIP database is configured", async () => {
    // Sans MaxMind configuré (cas par défaut), getCountry retourne null
    const result = await getCountry("8.8.8.8")
    expect(result).toBeNull()
  })

  it("should return null for a public IP", async () => {
    const result = await getCountry("1.1.1.1")
    expect(result).toBeNull()
  })

  it("should remain null on repeated calls (cache is populated but always null)", async () => {
    const result1 = await getCountry("8.8.8.8")
    expect(result1).toBeNull()

    const result2 = await getCountry("8.8.8.8")
    expect(result2).toBeNull()
  })

  it("should handle various IP formats without throwing", async () => {
    await expect(getCountry("192.168.0.1")).resolves.toBeNull()
    await expect(getCountry("10.0.0.1")).resolves.toBeNull()
    await expect(getCountry("172.16.0.1")).resolves.toBeNull()
  })
})
