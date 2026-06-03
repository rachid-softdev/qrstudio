import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import * as Sentry from "@sentry/nextjs"
import Stripe from "stripe"
import { prisma } from "@/server/db"
import { emailService } from "@/server/services/email.service"

export const authService = {
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

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
      },
    })

    const slug = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const workspace = await prisma.workspace.create({
      data: {
        name: `Espace de ${data.name}`,
        slug,
        ownerId: user.id,
      },
    })

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
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
}
