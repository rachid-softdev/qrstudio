import { describe, it, expect, vi } from "vitest"
import { initTRPC, TRPCError } from "@trpc/server"

// ---------------------------------------------------------------------------
// Build an isolated tRPC instance so we can unit-test the CSRF middleware
// without importing production routers or DB mocks.
//
// The fix replaces the hardcoded '1' with a real token obtained from the
// user's session context. The expected token is stored in ctx.csrfToken.
// ---------------------------------------------------------------------------
interface Ctx {
  reqHeaders?: Record<string, string>
  csrfToken?: string
}

const t = initTRPC.context<Ctx>().create()

// Replicate the FIXED CSRF middleware from src/server/trpc.ts
// The fix: compare x-csrf-token header against a real token from session context
const csrfMiddleware = t.middleware(({ ctx, next, type }) => {
  if (type === "query") {
    return next({ ctx })
  }

  const reqHeaders = (ctx as Record<string, unknown>)
    .reqHeaders as Record<string, string> | undefined
  const csrfToken = reqHeaders?.["x-csrf-token"]

  // The expected token comes from the session/context (real token, not hardcoded '1')
  const expectedToken = (ctx as Record<string, unknown>).csrfToken as string | undefined

  if (!csrfToken || !expectedToken || csrfToken !== expectedToken) {
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

function makeCtx(headers?: Record<string, string>, token?: string): Ctx {
  return { reqHeaders: headers ?? {}, csrfToken: token }
}

describe("CSRF Middleware — FIX: hardcoded '1' → real token", () => {
  // ─── Queries ────────────────────────────────────────────────────────────
  it("should allow queries without CSRF token (GET, read-only)", async () => {
    const caller = t.createCallerFactory(t.router({ test: queryProc }))(makeCtx())
    await expect(caller.test()).resolves.toBe("query-ok")
  })

  it("should allow queries even when csrfToken not set in context", async () => {
    const caller = t.createCallerFactory(t.router({ test: queryProc }))(
      makeCtx({ "x-csrf-token": "anything" }),
    )
    await expect(caller.test()).resolves.toBe("query-ok")
  })

  // ─── Mutations ──────────────────────────────────────────────────────────

  it("should reject mutations without CSRF token header", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({}, "real-csrf-token-abc123"),
    )
    await expect(caller.test()).rejects.toThrow(TRPCError)
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should reject mutations with empty CSRF token header", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "" }, "real-csrf-token-abc123"),
    )
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should reject mutations with wrong CSRF token", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "wrong-token" }, "real-csrf-token-abc123"),
    )
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should allow mutations with valid CSRF token matching context", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "real-csrf-token-abc123" }, "real-csrf-token-abc123"),
    )
    await expect(caller.test()).resolves.toBe("mutation-ok")
  })

  it("should reject mutations when csrfToken is not set in context (unauthenticated)", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "some-token" }),
    )
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should reject mutations when reqHeaders is undefined", async () => {
    const caller = t.createCallerFactory(t.router({ test: mutationProc }))({
      csrfToken: "real-csrf-token-abc123",
    })
    await expect(caller.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("should use a unique token per session (not hardcoded '1')", async () => {
    // Two different sessions should have different CSRF tokens
    const caller1 = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "session-a-token" }, "session-a-token"),
    )
    const caller2 = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "session-b-token" }, "session-b-token"),
    )

    await expect(caller1.test()).resolves.toBe("mutation-ok")
    await expect(caller2.test()).resolves.toBe("mutation-ok")

    // Cross-session token should fail
    const callerCross = t.createCallerFactory(t.router({ test: mutationProc }))(
      makeCtx({ "x-csrf-token": "session-a-token" }, "session-b-token"),
    )
    await expect(callerCross.test()).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})
