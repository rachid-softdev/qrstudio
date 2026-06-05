import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client singleton.
 *
 * NOTE: Prisma 5.x does not expose a global query timeout configuration.
 * For external API calls (Stripe, Resend, etc.) that need retry + timeout,
 * use the `withRetry` utility from `@/lib/retry`.
 *
 * Example:
 *   import { withRetry } from "@/lib/retry"
 *   await withRetry(() => prisma.user.findUnique({ where: { id } }))
 *
 * This ensures queries that hang (e.g. due to network issues or DB congestion)
 * eventually fail fast and can be retried with exponential backoff.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
