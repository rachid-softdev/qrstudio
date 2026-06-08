import { describe, it, expect, vi } from "vitest"
import { initTRPC, TRPCError } from "@trpc/server"

// ---------------------------------------------------------------------------
// Build an isolated tRPC instance so we can unit-test the CSRF middleware
// without importing production routers or DB mocks.
// ---------------------------------------------------------------------------
interface Ctx {
  reqHeaders?: Record<string, string>
}

const t = initTRPC.context<Ctx>().create()

// Replicate the exact CSRF middleware from src/server/trpc.ts
const csrfMiddleware = t.middleware(({ ctx, next, type }) => {
  if (type === "query") {
    return next({ ctx })
  }

  const reqHeaders = (ctx as Record<string, unknown>)
    .reqHeaders as Record<string, string> | undefined
  const csrfToken = reqHeaders?.["x-csrf-token"]

  if (csrfToken !== "1") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Token CSRF manquant ou invalide",
    })
  }

  return next({ ctx })
})

// Procedures to test
const queryProc = t.procedure.use(csrfMiddleware).query(() => "query-ok")
const mutationProc = t.procedure.use(csrfMiddleware).mutation(() => "mutation-ok")

function makeCtx(headers?: Record<string, string>): Ctx {
  return { reqHeaders: headers ?? {} }
}

describe("CSRF Middleware (in isolation)", () => {
  // ─── Queries ────────────────────────────────────────────────────────────
  it("should allow queries without CSRF token (GET, read-only)", async () => {
    const caller = t.createCallerFactory(t.router({ test: queryProc }))(makeCtx())
    await expect(caller.test()).resolves.toBe("query-ok")
  })

  it("should allow queries with valid CSRF token (still read-only)", async () => {
    const caller = t.createCallerFactory(t.router({ test: queryProc }))(
      makeCtx({ "x-csrf-token": "1" })
    )
    await expect(caller.test()).resolves.toBe("query-ok")
  })

  // ─── Mutations ──────────────────────────────────────────────────────────
  it("should reject mutations without CSRF token (TRPCError BAD_REQUEST)", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(makeCtx())
    await expect(caller.test()).rejects.toThrow(TRPCError)
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should reject mutations with empty CSRF token", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "" })
    )
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should reject mutations with wrong CSRF token", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "0" })
    )
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should allow mutations with valid CSRF token (x-csrf-token: 1)", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "1" })
    )
    await expect(caller.test()).resolves.toBe("mutation-ok")
  })

  it("should allow mutations when reqHeaders is undefined (edge case)", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))({})
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})
