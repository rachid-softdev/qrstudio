// UTILISÉ PAR : src/app/api/qr/[shortCode]/route.ts (Edge Runtime)
// Ce fichier n'est PAS du code mort.
// Ne pas supprimer sans vérifier qu'aucune route Edge ne l'importe.

import { PrismaClient } from "@prisma/client"
import { withAccelerate } from "@prisma/extension-accelerate"

/**
 * PrismaClient compatible with Edge Runtime via Prisma Accelerate.
 * Uses DATABASE_URL_UNPOOLED for HTTP connection pooling.
 * This client is not cached as a singleton — Edge Functions should
 * create a fresh instance per request for optimal cold start.
 *
 * SÉCURITÉ : le cast `as unknown as PrismaClient` est intentionnel.
 * Prisma Accelerate retourne un proxy compatible PrismaClient mais
 * avec un type différent. Le typage partiel est volontaire — ne pas
 * remplacer par `as any`.
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
