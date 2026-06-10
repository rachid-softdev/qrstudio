import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// We mock the db module to prevent validateEnv from being called on import
vi.mock("@/server/db", () => ({ prisma: {} }))

describe("Env Validation", () => {
  let envVarsBackup: Record<string, string | undefined>

  beforeEach(() => {
    envVarsBackup = { ...process.env }
  })

  afterEach(() => {
    // Restore original env vars
    process.env = Object.assign({}, envVarsBackup) as typeof process.env
    vi.resetModules()
  })

  // ─── Helper ──────────────────────────────────────────────────────────────
  function setEnv(vars: Record<string, string>) {
    for (const [key, value] of Object.entries(vars)) {
      process.env[key] = value
    }
  }

  function clearEnv(keys: string[]) {
    for (const key of keys) {
      delete process.env[key]
    }
  }

  // ─── All required env vars are validated ──────────────────────────────────

  it("should pass validation when all required vars are present", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.NEXTAUTH_SECRET).toBe("a".repeat(32))
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test")
    expect(env.NODE_ENV).toBe("test")
  })

  it("should apply defaults for NEXTAUTH_URL and NEXT_PUBLIC_APP_URL", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000")
    expect(env.NODE_ENV).toBe("test")
  })

  // ─── Missing critical var throws on validateEnv/getEnv call ───────────────

  it("should throw if NEXTAUTH_SECRET is missing", async () => {
    setEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://localhost:5432/test",
    })
    clearEnv(["NEXTAUTH_SECRET"])

    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow()
  })

  it("should throw if NEXTAUTH_SECRET is too short (< 32 chars)", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "short",
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow()
  })

  it("should throw if DATABASE_URL is missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
    })
    clearEnv(["DATABASE_URL"])

    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow()
  })

  it("should throw if DATABASE_URL is not a valid URL", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "not-a-url",
    })

    const { getEnv } = await import("@/lib/env")
    expect(() => getEnv()).toThrow()
  })

  // ─── Optional vars are not required ──────────────────────────────────────

  it("should not require GOOGLE_CLIENT_ID when missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
  })

  it("should not require RESEND_API_KEY when missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.RESEND_API_KEY).toBeUndefined()
  })

  it("should not require STRIPE_SECRET_KEY when missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.STRIPE_SECRET_KEY).toBeUndefined()
  })

  it("should not require UPSTASH_REDIS_URL when missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.UPSTASH_REDIS_URL).toBeUndefined()
  })

  it("should not require Sentry DSN when missing", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.SENTRY_DSN).toBeUndefined()
  })

  // ─── validateEnv function ─────────────────────────────────────────────────

  it("should return parsed env via validateEnv()", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })

    const { validateEnv } = await import("@/lib/env")
    const env = validateEnv()

    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/test")
    expect(env.NODE_ENV).toBe("test")
  })

  it("should coerce PORT to number", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
      PORT: "4000",
    })

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.PORT).toBe(4000)
  })

  it("should default PORT to 3000", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://localhost:5432/test",
    })
    clearEnv(["PORT"])

    const { getEnv } = await import("@/lib/env")
    const env = getEnv()

    expect(env.PORT).toBe(3000)
  })
})
