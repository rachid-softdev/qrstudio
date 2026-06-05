import { TRPCError } from "@trpc/server"
import { prisma } from "@/server/db"
import { emailService } from "@/server/services/email.service"
import { PLAN_LIMITS } from "@/lib/constants"
import type { Role, Plan } from "@/types/index"

export const teamService = {
  async invite(workspaceId: string, email: string, role: Role, invitedByUserId: string) {
    const inviter = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: invitedByUserId } },
      include: { user: { select: { name: true } } },
    })

    if (!inviter || inviter.role !== "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Seul le propriétaire peut inviter des membres",
      })
    }

    const existingInvitation = await prisma.workspaceInvitation.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
    })

    if (existingInvitation && !existingInvitation.acceptedAt && existingInvitation.expiresAt > new Date()) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Une invitation est déjà en cours pour cet email",
      })
    }

    const existingMember = await prisma.user.findUnique({ where: { email } })
    if (existingMember) {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingMember.id } },
      })
      if (member) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cet utilisateur est déjà membre de l'espace de travail",
        })
      }
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, ownerId: true, owner: { select: { plan: true as const } } },
    })

    if (!workspace) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Espace de travail introuvable" })
    }

    const plan = workspace.owner.plan as Plan
    const limit = PLAN_LIMITS[plan].maxTeamMembers

    if (limit !== Infinity) {
      const currentMembers = await prisma.workspaceMember.count({
        where: { workspaceId },
      })
      if (currentMembers >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de membres atteinte pour le plan ${plan}`,
        })
      }
    }

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role: role as "OWNER" | "EDITOR" | "VIEWER",
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    emailService.sendInvitationEmail(
      email,
      workspace.name,
      invitation.token,
      inviter.user.name ?? "Un membre"
    ).catch(() => {
      /* already logged in emailService */
    })

    return { success: true }
  },

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: { select: { name: true } } },
    })

    if (!invitation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invitation introuvable",
      })
    }

    if (invitation.expiresAt < new Date()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Cette invitation a expiré",
      })
    }

    if (invitation.acceptedAt) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cette invitation a déjà été acceptée",
      })
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    })

    if (existingMember) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Vous êtes déjà membre de cet espace de travail",
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      })

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      })
    })

    return { workspaceId: invitation.workspaceId, workspaceName: invitation.workspace.name }
  },

  async listMembers(workspaceId: string) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }))
  },

  async updateMemberRole(workspaceId: string, userId: string, role: Role, currentUserId: string) {
    const currentMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
    })

    if (!currentMember || currentMember.role !== "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Seul le propriétaire peut modifier les rôles",
      })
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })

    if (!targetMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Membre introuvable",
      })
    }

    if (targetMember.role === "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Impossible de modifier le rôle du propriétaire",
      })
    }

    await prisma.workspaceMember.update({
      where: { id: targetMember.id },
      data: { role: role as "OWNER" | "EDITOR" | "VIEWER" },
    })

    return { success: true }
  },

  async removeMember(workspaceId: string, userId: string, currentUserId: string) {
    const currentMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
    })

    if (!currentMember || currentMember.role !== "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Seul le propriétaire peut retirer des membres",
      })
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })

    if (!targetMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Membre introuvable",
      })
    }

    if (targetMember.role === "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Impossible de retirer le propriétaire",
      })
    }

    await prisma.workspaceMember.delete({
      where: { id: targetMember.id },
    })

    return { success: true }
  },

  async listInvitations(workspaceId: string) {
    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    }))
  },
}
