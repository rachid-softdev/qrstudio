import crypto from "crypto"
import { TRPCError } from "@trpc/server"
import { prisma } from "@/server/db"

export const apiKeyService = {
  async generate(userId: string, name: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" })
    }

    if (user.plan === "FREE") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Les clés API sont disponibles à partir du plan Pro",
      })
    }

    const rawKey = "qrs_" + crypto.randomBytes(32).toString("hex")
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 8)

    await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
      },
    })

    return { key: rawKey, prefix: keyPrefix, name }
  },

  async list(userId: string) {
    const keys = await prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return keys
  },

  async revoke(id: string, userId: string) {
    const key = await prisma.apiKey.findFirst({
      where: { id, userId },
    })

    if (!key) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Clé API introuvable" })
    }

    if (key.revokedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cette clé est déjà révoquée",
      })
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    return { success: true }
  },

  async validate(key: string) {
    const keyHash = crypto.createHash("sha256").update(key).digest("hex")

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { userId: true, revokedAt: true, id: true },
    })

    if (!apiKey) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Clé API invalide",
      })
    }

    if (apiKey.revokedAt) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Clé API révoquée",
      })
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    return { userId: apiKey.userId }
  },
}
