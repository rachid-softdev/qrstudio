import { PrismaClient } from "@prisma/client"
import { withAccelerate } from "@prisma/extension-accelerate"

/**
 * PrismaClient compatible with Edge Runtime via Prisma Accelerate.
 * Uses DATABASE_URL_UNPOOLED for HTTP connection pooling.
 * This client is not cached as a singleton — Edge Functions should
 * create a fresh instance per request for optimal cold start.
 */
export function createEdgePrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
      },
    },
  })

  return client.$extends(withAccelerate()) as unknown as PrismaClient
}
