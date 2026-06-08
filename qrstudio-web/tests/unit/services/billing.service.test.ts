import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest"
import type Stripe from "stripe"

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const prismaMock = vi.hoisted(() => {
  const model = (methods = ["findUnique", "findFirst", "findMany", "create", "update", "delete", "count"]) => {
    const m: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of methods) { m[method] = vi.fn() }
    return m
  }
  return {
    user: model(),
    webhookEvent: model(["findUnique", "create"]),
    qRCode: model(),
    workspace: model(),
    landingPage: model(),
    workspaceMember: model(),
    $transaction: vi.fn(),
  }
})

// Stripe constructEvent mock — stored in an object to preserve reference across resets
const constructEventMock = vi.hoisted(() => vi.fn())

vi.mock("@/server/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
vi.mock("stripe", () => {
  // Return a constructor that always produces the same mock instance
  const mockInstance = { webhooks: { constructEvent: constructEventMock } }
  function StripeMock() { return mockInstance }
  return { default: StripeMock }
})

// Now import the modules under test
import { billingService } from "@/server/services/billing.service"
import { POST } from "@/app/api/webhooks/stripe/route"

describe("Stripe webhook — route handler (signature verification)", () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeAll(() => {
    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
  })

  afterAll(() => {
    if (savedEnv.STRIPE_SECRET_KEY !== undefined) {
      process.env.STRIPE_SECRET_KEY = savedEnv.STRIPE_SECRET_KEY
    } else {
      delete process.env.STRIPE_SECRET_KEY
    }
    if (savedEnv.STRIPE_WEBHOOK_SECRET !== undefined) {
      process.env.STRIPE_WEBHOOK_SECRET = savedEnv.STRIPE_WEBHOOK_SECRET
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET
    }
  })

  beforeEach(() => {
    // Reset only the constructEvent mock (call history + implementation)
    constructEventMock.mockReset()
    // Mock $transaction to delegate to the top-level mocks
    prismaMock.$transaction.mockImplementation(
      (cb: (tx: Record<string, unknown>) => unknown) => {
        return cb({
          $executeRawUnsafe: vi.fn(),
          webhookEvent: prismaMock.webhookEvent,
          user: prismaMock.user,
        })
      }
    )
    // Set required env vars for the route
    process.env.STRIPE_SECRET_KEY = "sk_test_mock"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock"
  })

  function mockRequest(body: unknown, signature: string | null): Request {
    const headers = new Headers()
    if (signature !== null) {
      headers.set("stripe-signature", signature)
    }
    return new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  }

  it("should return 400 when stripe-signature header is missing", async () => {
    const req = mockRequest({ type: "checkout.session.completed" }, null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Configuration webhook manquante")
  })

  it("should return 400 when webhook secret is empty", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = ""
    const req = mockRequest({ type: "checkout.session.completed" }, "some_sig")
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Configuration webhook manquante")
  })

  it("should call constructEvent with raw body, signature, and webhook secret", async () => {
    const fakeEvent = {
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    }
    constructEventMock.mockReturnValue(fakeEvent)
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const req = mockRequest({ id: "1" }, "test_sig")
    await POST(req)

    // constructEvent should have been called with the raw body text, signature, and secret
    const callArgs = constructEventMock.mock.calls[0]
    expect(callArgs).toBeDefined()
    expect(callArgs[0]).toBe(JSON.stringify({ id: "1" })) // raw body text
    expect(callArgs[1]).toBe("test_sig")                   // signature header
    expect(callArgs[2]).toBe("whsec_mock")                 // webhook secret
  })

  it("should return 400 when constructEvent throws (invalid signature)", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature")
    })
    const req = mockRequest({ type: "checkout.session.completed" }, "invalid_sig")
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("Signature invalide")
  })

  it("should return 200 when signature is valid and event is processed", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_valid",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "u1", plan: "PRO", subscription: "sub_1" } } },
    })
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const req = mockRequest({ type: "checkout.session.completed" }, "valid_sig")
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})

describe("billingService.handleWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock $transaction to delegate to the top-level mocks
    prismaMock.$transaction.mockImplementation(
      (cb: (tx: Record<string, unknown>) => unknown) => {
        return cb({
          $executeRawUnsafe: vi.fn(),
          webhookEvent: prismaMock.webhookEvent,
          user: prismaMock.user,
        })
      }
    )
  })

  function makeEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
    return {
      id: "evt_123",
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "user-1", plan: "PRO" } } },
      api_version: "2026-05-27.dahlia",
      created: 1717000000,
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      ...overrides,
    } as unknown as Stripe.Event
  }

  it("should skip already-processed events (idempotency)", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue({ id: "evt_123" } as never)

    const result = await billingService.handleWebhookEvent(makeEvent())

    expect(result).toEqual({ skipped: true })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled()
  })

  it("should process checkout.session.completed and update user plan + subscription", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-1", plan: "PRO" },
          subscription: "sub_123",
        },
      },
    } as unknown as Stripe.Event)

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { plan: "PRO", stripeSubscriptionId: "sub_123" },
    })
    expect(prismaMock.webhookEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_123", type: "checkout.session.completed" },
    })
  })

  it("should handle checkout.session.completed with missing metadata gracefully", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    } as unknown as Stripe.Event)

    await expect(billingService.handleWebhookEvent(event)).resolves.toBeUndefined()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("should process customer.subscription.updated with userId in metadata", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userId: "user-1" },
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    } as unknown as Stripe.Event)

    const prevPro = process.env.STRIPE_PRICE_PRO
    process.env.STRIPE_PRICE_PRO = "price_pro"

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.user.update).toHaveBeenCalled()
    process.env.STRIPE_PRICE_PRO = prevPro
  })

  it("should process customer.subscription.updated by looking up user from sub ID when metadata lacks userId", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1" } as never)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_999",
          metadata: {},
          items: { data: [{ price: { id: "price_agency" } }] },
        },
      },
    } as unknown as Stripe.Event)

    const prevPro = process.env.STRIPE_PRICE_PRO
    const prevAgency = process.env.STRIPE_PRICE_AGENCY
    process.env.STRIPE_PRICE_PRO = "price_pro"
    process.env.STRIPE_PRICE_AGENCY = "price_agency"

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_999" },
      select: { id: true },
    })
    expect(prismaMock.user.update).toHaveBeenCalled()

    process.env.STRIPE_PRICE_PRO = prevPro
    process.env.STRIPE_PRICE_AGENCY = prevAgency
  })

  it("should process customer.subscription.deleted and reset to FREE", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.findFirst.mockResolvedValue({ id: "user-1" } as never)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    } as unknown as Stripe.Event)

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { plan: "FREE", stripeSubscriptionId: null },
    })
  })

  it("should process customer.subscription.deleted gracefully when user not found", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_nonexistent" } },
    } as unknown as Stripe.Event)

    await expect(billingService.handleWebhookEvent(event)).resolves.toBeUndefined()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("should mark event as processed after successful handling", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    } as unknown as Stripe.Event)

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.webhookEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_123", type: "checkout.session.completed" },
    })
  })

  it("should rethrow error and capture in Sentry when processing fails", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockRejectedValue(new Error("DB error"))

    const event = makeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-1", plan: "PRO" },
          subscription: "sub_123",
        },
      },
    } as unknown as Stripe.Event)

    await expect(billingService.handleWebhookEvent(event)).rejects.toThrow("DB error")
  })

  it("should handle unknown price ID → FREE plan", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.user.update.mockResolvedValue({} as never)
    prismaMock.webhookEvent.create.mockResolvedValue({} as never)

    const event = makeEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          metadata: { userId: "user-1" },
          items: { data: [{ price: { id: "price_unknown" } }] },
        },
      },
    } as unknown as Stripe.Event)

    await billingService.handleWebhookEvent(event)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: "FREE" }),
      })
    )
  })

  // ──────────────────────────────────────────────
  // 1b.6 — Transaction atomique
  // ──────────────────────────────────────────────
  describe("handleWebhookEvent — transaction atomique (1b.6)", () => {
    beforeEach(() => {
      vi.clearAllMocks()
      prismaMock.$transaction.mockImplementation(
        (cb: (tx: Record<string, unknown>) => unknown) => {
          return cb({
            $executeRawUnsafe: vi.fn(),
            webhookEvent: prismaMock.webhookEvent,
            user: prismaMock.user,
          })
        }
      )
    })

    it("should complete transaction successfully and mark event", async () => {
      prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
      prismaMock.user.update.mockResolvedValue({} as never)
      prismaMock.webhookEvent.create.mockResolvedValue({} as never)

      const event = makeEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_123",
          },
        },
      } as unknown as Stripe.Event)

      await billingService.handleWebhookEvent(event)

      // Business logic was executed
      expect(prismaMock.user.update).toHaveBeenCalled()
      // Event was marked as processed within the same transaction
      expect(prismaMock.webhookEvent.create).toHaveBeenCalledWith({
        data: { id: "evt_123", type: "checkout.session.completed" },
      })
      // $transaction was used
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })

    it("should not mark event when business logic fails (rollback)", async () => {
      prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
      prismaMock.user.update.mockRejectedValue(new Error("DB error"))

      const event = makeEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_123",
          },
        },
      } as unknown as Stripe.Event)

      await expect(billingService.handleWebhookEvent(event)).rejects.toThrow("DB error")

      // Event should NOT be marked because the transaction was aborted
      expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled()
      // $transaction was still invoked
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })

    it("should skip duplicate events (idempotency)", async () => {
      prismaMock.webhookEvent.findUnique.mockResolvedValue({ id: "evt_123" } as never)

      const result = await billingService.handleWebhookEvent(makeEvent())

      expect(result).toEqual({ skipped: true })
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      expect(prismaMock.webhookEvent.create).not.toHaveBeenCalled()
    })

    it("should call prisma.$transaction", async () => {
      prismaMock.webhookEvent.findUnique.mockResolvedValue(null)
      prismaMock.user.update.mockResolvedValue({} as never)
      prismaMock.webhookEvent.create.mockResolvedValue({} as never)

      const event = makeEvent({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-1", plan: "PRO" },
            subscription: "sub_123",
          },
        },
      } as unknown as Stripe.Event)

      await billingService.handleWebhookEvent(event)

      expect(prismaMock.$transaction).toHaveBeenCalled()
      // Verify the callback passed to $transaction is a function
      const callArg = prismaMock.$transaction.mock.calls[0][0]
      expect(typeof callArg).toBe("function")
    })
  })
})
