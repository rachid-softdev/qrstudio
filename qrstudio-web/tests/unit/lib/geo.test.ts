import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCountry } from "@/lib/geo"

const mockFetch = vi.fn()

describe("getCountry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  it("should fetch from ip-api.com and return country", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", country: "France" }),
    })

    const result = await getCountry("8.8.8.8")
    expect(result).toBe("France")
    expect(mockFetch).toHaveBeenCalledWith(
      "https://ip-api.com/json/8.8.8.8",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it("should return cached result on second call without fetching", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", country: "Germany" }),
    })

    const result1 = await getCountry("1.1.1.1")
    expect(result1).toBe("Germany")
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Replace fetch with one that throws — cache should prevent it from being called
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("should not fetch"))
    const result2 = await getCountry("1.1.1.1")
    expect(result2).toBe("Germany")
  })

  it("should return null if ip-api.com fails (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))
    const result = await getCountry("2.2.2.2")
    expect(result).toBeNull()
  })

  it("should return null if ip-api.com returns non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await getCountry("3.3.3.3")
    expect(result).toBeNull()
  })

  it("should return null if ip-api.com returns status not success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "fail" }),
    })
    const result = await getCountry("4.4.4.4")
    expect(result).toBeNull()
  })
})
