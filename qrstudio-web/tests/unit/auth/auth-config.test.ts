import { describe, it, expect, vi } from "vitest"

// Mock next-auth and its providers to avoid next/server resolution issues
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))
vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}))
vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({
    name: "credentials",
    type: "credentials",
    authorize: vi.fn(),
  })),
}))
vi.mock("@/server/db", () => ({ prisma: {} }))
vi.mock("@/server/services/auth.service", () => ({ authService: {} }))
vi.mock("bcryptjs", () => ({ default: { compare: () => false } }))

import { authConfig } from "@/server/auth"

describe("authConfig — JWT session configuration (1b.5)", () => {
  it("should set session strategy to jwt", () => {
    expect(authConfig.session?.strategy).toBe("jwt")
  })

  it("should set maxAge to 86400 (24 hours)", () => {
    // 24 * 60 * 60 = 86400 seconds
    expect(authConfig.session?.maxAge).toBe(86400)
  })

  it("should set updateAge to 300 (5 minutes) for fast session refresh", () => {
    // 5 * 60 = 300 seconds — sécurité : rafraîchit le JWT toutes les 5 min
    // pour refléter rapidement les changements de plan/rôle depuis la DB
    expect(authConfig.session?.updateAge).toBe(300)
  })

  it("should have maxAge defined as a number", () => {
    expect(typeof authConfig.session?.maxAge).toBe("number")
    expect(authConfig.session?.maxAge).toBeGreaterThan(0)
  })

  it("should have updateAge defined as a number", () => {
    expect(typeof authConfig.session?.updateAge).toBe("number")
    expect(authConfig.session?.updateAge).toBeGreaterThan(0)
  })

  it("should have updateAge smaller than maxAge", () => {
    // updateAge should logically be less than maxAge
    expect((authConfig.session?.updateAge ?? 0)).toBeLessThan(authConfig.session?.maxAge ?? Infinity)
  })
})
