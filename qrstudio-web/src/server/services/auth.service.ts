import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import * as Sentry from "@sentry/nextjs"
import Stripe from "stripe"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/server/db"
import { emailService } from "@/server/services/email.service"
import { totpService } from "@/server/services/totp.service"
import { checkTotpRateLimit } from "@/lib/rate-limit"

interface PartialTokenPayload {
  userId: string
  type: string
  iat?: number
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export const authService = {
  async checkLockout(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { loginAttempts: true, lockoutUntil: true },
    })
    if (!user) return
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remaining = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 1000 / 60
      )
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Compte verrouillé. Réessayez dans ${remaining} minute(s).`,
      })
    }
    if (user.lockoutUntil && user.lockoutUntil <= new Date()) {
      await prisma.user.update({
        where: { email },
        data: { loginAttempts: 0, lockoutUntil: null },
      })
    }
  },

  async recordFailedAttempt(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { loginAttempts: true },
    })
    if (!user) return
    const newAttempts = user.loginAttempts + 1
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await prisma.user.update({
        where: { email },
        data: {
          loginAttempts: newAttempts,
          lockoutUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        },
      })
    } else {
      await prisma.user.update({
        where: { email },
        data: { loginAttempts: newAttempts },
      })
    }
  },

  async resetLoginAttempts(email: string): Promise<void> {
    await prisma.user.update({
      where: { email },
      data: { loginAttempts: 0, lockoutUntil: null },
    })
  },

  async register(data: { name: string; email: string; password: string }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cet email est déjà utilisé",
      })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const slug = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const { user, workspace } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
        },
      })

      const workspace = await tx.workspace.create({
        data: {
          name: `Espace de ${data.name}`,
          slug,
          ownerId: user.id,
        },
      })

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      })

      return { user, workspace }
    })

    // L'envoi d'email ne doit pas bloquer l'inscription
    emailService.sendWelcomeEmail(data.email, data.name).catch(() => {
      /* already logged in emailService */
    })

    return { userId: user.id, workspaceId: workspace.id }
  },

  async updateProfile(
    userId: string,
    data: { name?: string; image?: string }
  ) {
    const updateData: Record<string, string> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.image !== undefined) updateData.image = data.image

    if (Object.keys(updateData).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Aucune donnée à mettre à jour",
      })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return { id: user.id, name: user.name, image: user.image }
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    })

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      })
    }

    if (!user.passwordHash) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Impossible de changer le mot de passe d'un compte social",
      })
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Mot de passe actuel incorrect",
      })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    emailService.sendPasswordChanged(user.email).catch(() => {
      /* already logged in emailService */
    })

    return { success: true }
  },

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        stripeSubscriptionId: true,
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      })
    }

    // Annuler l'abonnement Stripe si actif
    if (user.stripeSubscriptionId) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
        await stripe.subscriptions.cancel(user.stripeSubscriptionId)
      } catch {
        Sentry.captureException(
          new Error("Échec annulation abonnement Stripe")
        )
      }
    }

    // La cascade Prisma supprime Account, Session, WorkspaceMember,
    // Workspace, QRCode, Scan, ApiKey automatiquement
    await prisma.user.delete({ where: { id: userId } })

    // L'envoi d'email ne doit pas bloquer la suppression
    emailService.sendAccountDeletionConfirmation(user.email).catch(() => {
      /* already logged in emailService */
    })
  },

  // ─── TOTP ────────────────────────────────────────────────────────────────

  async generateTotpSetup(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" })
    if (user.totpEnabled) throw new TRPCError({ code: "FORBIDDEN", message: "TOTP déjà activé" })

    const { secret, uri } = totpService.generateSecret()
    await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } })

    return { secret, uri }
  },

  async verifyAndEnableTotp(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpSecret)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Aucun secret TOTP généré" })
    if (user.totpEnabled) throw new TRPCError({ code: "FORBIDDEN", message: "TOTP déjà activé" })

    if (!totpService.verifyToken(token, user.totpSecret)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Code invalide" })
    }

    const { plain, hashed } = totpService.generateBackupCodes()
    const backupCodes = hashed.map((h) => ({ code_hash: h, used: false }))

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpBackupCodes: backupCodes as unknown as Prisma.InputJsonValue,
        totpVerifiedAt: new Date(),
      },
    })

    return { backupCodes: plain }
  },

  async verifyTotpChallenge(partialToken: string, token: string, clientIp?: string) {
    // Rate limiting: 5 tentatives par minute par IP
    if (clientIp) {
      const { success } = await checkTotpRateLimit(clientIp)
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Trop de tentatives. Réessayez dans une minute.",
        })
      }
    }

    const { userId } = await verifyPartialToken(partialToken)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "TOTP non configuré" })
    }

    if (!totpService.verifyToken(token, user.totpSecret)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Code invalide" })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpVerifiedAt: new Date() },
    })

    return { verified: true }
  },

  async verifyBackupCode(partialToken: string, backupCode: string, clientIp?: string) {
    // Rate limiting: 5 tentatives par minute par IP
    if (clientIp) {
      const { success } = await checkTotpRateLimit(clientIp)
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Trop de tentatives. Réessayez dans une minute.",
        })
      }
    }

    const { userId } = await verifyPartialToken(partialToken)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpEnabled || !user.totpBackupCodes) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "TOTP non configuré" })
    }

    const codes = user.totpBackupCodes as { code_hash: string; used: boolean }[]
    const index = totpService.verifyBackupCode(backupCode, codes)
    if (index === -1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Code de secours invalide ou déjà utilisé",
      })
    }

    codes[index].used = true
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: codes as unknown as Prisma.InputJsonValue, totpVerifiedAt: new Date() },
    })

    return { verified: true }
  },

  async disableTotp(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.totpEnabled)
      throw new TRPCError({ code: "BAD_REQUEST", message: "TOTP non activé" })

    const bcrypt = await import("bcryptjs")
    if (user.passwordHash) {
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Mot de passe incorrect" })
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpVerifiedAt: null,
      },
    })

    return { success: true }
  },

  async createPartialAuthToken(userId: string): Promise<string> {
    const { default: jwt } = await import("jsonwebtoken")
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) throw new Error("NEXTAUTH_SECRET not configured")

    return jwt.sign({ userId, type: "partial_auth" }, secret, { expiresIn: "5m" })
  },
}

async function verifyPartialToken(partialToken: string): Promise<{ userId: string }> {
  try {
    const { default: jwt } = await import("jsonwebtoken")
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) throw new Error("NEXTAUTH_SECRET not configured")

    const decoded = jwt.verify(partialToken, secret) as PartialTokenPayload
    if (decoded.type !== "partial_auth") {
      throw new Error("Token invalide")
    }
    return { userId: decoded.userId }
  } catch (err) {
    if (err instanceof TRPCError) throw err
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session expirée, veuillez vous reconnecter",
    })
  }
}
