import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
// We need to mock the Stripe constructor to avoid actually instantiating Stripe.
// vitest v4 requires a real class when the mock is called with `new`.
// We use a class and track constructor calls via a separate spy fn.
const mockStripeCalls = vi.hoisted(() => vi.fn())

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      customers = {}
      products = {}
      prices = {}
      checkout = {}
      webhooks = {}

      constructor(key: string, opts: Record<string, unknown>) {
        mockStripeCalls(key, opts)
      }
    },
  }
})

describe("getStripeClient", () => {
  let mod: typeof import("@/lib/stripe")

  beforeEach(() => {
    vi.resetModules()
    mockStripeCalls.mockClear()

    mod = {} as typeof import("@/lib/stripe")
  })

  async function loadModule(envKey?: string) {
    if (envKey !== undefined) {
      process.env.STRIPE_SECRET_KEY = envKey
    } else {
      // Restore original or set test key
      process.env.STRIPE_SECRET_KEY = "sk_test_xxxxxxxxxxxxxxxxxxxx"
    }
    vi.resetModules()
    mod = await import("@/lib/stripe")
  }

  it("throws a descriptive error when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY
    vi.resetModules()
    const m = await import("@/lib/stripe")
    expect(() => m.getStripeClient()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it("throws when STRIPE_SECRET_KEY is empty string", async () => {
    process.env.STRIPE_SECRET_KEY = ""
    vi.resetModules()
    const m = await import("@/lib/stripe")
    expect(() => m.getStripeClient()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it("returns a Stripe client when key is set", async () => {
    await loadModule("sk_test_validkey")
    const client = mod.getStripeClient()
    expect(client).toBeDefined()
    expect(client.customers).toBeDefined()
    // The Stripe constructor should have been called once
    expect(mockStripeCalls).toHaveBeenCalledTimes(1)
    expect(mockStripeCalls).toHaveBeenCalledWith(
      "sk_test_validkey",
      expect.objectContaining({ apiVersion: expect.any(String) }),
    )
  })

  it("returns the same instance on repeated calls (singleton)", async () => {
    await loadModule("sk_test_singleton")
    const client1 = mod.getStripeClient()
    const client2 = mod.getStripeClient()
    expect(client1).toBe(client2)
    // Constructor called only once
    expect(mockStripeCalls).toHaveBeenCalledTimes(1)
  })

  it("creates a new instance after module reset", async () => {
    await loadModule("sk_test_first")

    const client1 = mod.getStripeClient()
    expect(mockStripeCalls).toHaveBeenCalledTimes(1)

    // Reset modules and create a second client with a different key
    vi.resetModules()
    mockStripeCalls.mockClear()
    process.env.STRIPE_SECRET_KEY = "sk_test_second"

    const mod2 = await import("@/lib/stripe")
    const client2 = mod2.getStripeClient()

    expect(client2).toBeDefined()
    expect(client2).not.toBe(client1) // different instance
    expect(mockStripeCalls).toHaveBeenCalledTimes(1)
    expect(mockStripeCalls).toHaveBeenCalledWith(
      "sk_test_second",
      expect.objectContaining({ apiVersion: expect.any(String) }),
    )
  })

  it("throws on first call when key is missing, then succeeds if key is set after module reload", async () => {
    // First: missing key
    delete process.env.STRIPE_SECRET_KEY
    vi.resetModules()
    const modFail = await import("@/lib/stripe")
    expect(() => modFail.getStripeClient()).toThrow(/STRIPE_SECRET_KEY/)

    // Second: set key and reload
    process.env.STRIPE_SECRET_KEY = "sk_test_afterthrow"
    vi.resetModules()
    const modSuccess = await import("@/lib/stripe")
    const client = modSuccess.getStripeClient()
    expect(client).toBeDefined()
    expect(client.customers).toBeDefined()
  })

  it("passes the correct apiVersion to Stripe constructor", async () => {
    await loadModule("sk_test_api_version")
    mod.getStripeClient()
    expect(mockStripeCalls).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        apiVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}\.\w+$/),
      }),
    )
  })
})
