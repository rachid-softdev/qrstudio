import { PrismaClient } from "@prisma/client"
import { validateEnv } from "@/lib/env"

// Valider les variables d'environnement au démarrage (premier module serveur chargé)
validateEnv()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const QUERY_TIMEOUT_MS = 15_000 // 15 secondes

/**
 * Prisma client singleton avec middleware de timeout.
 *
 * Chaque requête Prisma est protégée par un timeout de 15 secondes.
 * Si une requête dépasse cette durée, elle est rejetée avec une erreur.
 *
 * Pour les appels API externes (Stripe, Resend, etc.) qui nécessitent
 * retry + timeout, utiliser `withRetry` depuis `@/lib/retry`.
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

  // Middleware de timeout : rejette toute requête qui dépasse QUERY_TIMEOUT_MS
  client.$use(async (params, next) => {
    const result = await Promise.race([
      next(params),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Prisma query timeout (${QUERY_TIMEOUT_MS}ms): ${params.model}.${params.action}`)),
          QUERY_TIMEOUT_MS,
        ),
      ),
    ])
    return result
  })

  return client
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
