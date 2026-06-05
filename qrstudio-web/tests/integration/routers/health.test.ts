import { describe, it, expect, vi, beforeEach } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $disconnect: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/server/db", () => ({
  prisma: prismaMock,
}))
vi.mock("stripe", () => ({
  default: function StripeMock() {
    return {
      balance: { retrieve: vi.fn().mockResolvedValue({}) },
    }
  },
}))

import { GET as healthGet } from "@/app/api/health/route"
import { GET as readyGet } from "@/app/api/health/ready/route"

describe("/api/health", () => {
  it("should return 200 with status ok", async () => {
    const response = await healthGet()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toMatchObject({ status: "ok" })
    expect(body).toHaveProperty("timestamp")
    expect(body).toHaveProperty("version")
  })
})

describe("/api/health/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 200 with ok when all checks pass", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "1": 1 }])
    // No STRIPE_SECRET_KEY set, so only database is checked

    const response = await readyGet()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.status).toBe("ok")
    expect(body.checks.database).toEqual({ status: "ok" })
    expect(body.checks).not.toHaveProperty("stripe")
  })

  it("should return 503 when DB is down", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("DB connection failed"))

    const response = await readyGet()
    expect(response.status).toBe(503)

    const body = await response.json()
    expect(body.status).toBe("degraded")
    expect(body.checks.database).toEqual({ status: "error", error: expect.any(String) })
  })

  it("should include stripe check when STRIPE_SECRET_KEY is set", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "1": 1 }])
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx")

    const response = await readyGet()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.checks.stripe).toEqual({ status: "ok" })

    vi.unstubAllEnvs()
  })
})
