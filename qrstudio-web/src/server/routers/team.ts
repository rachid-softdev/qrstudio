import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { publicProcedure, workspaceProcedure, router, requireWorkspaceAccess } from "@/server/trpc"
import { teamService } from "@/server/services/team.service"
import { prisma } from "@/server/db"

const RoleEnum = z.enum(["OWNER", "EDITOR", "VIEWER"])

const wsQuery = async (userId: string, workspaceId: string) => {
  return requireWorkspaceAccess(userId, workspaceId)
}

export const teamRouter = router({
  listMembers: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await wsQuery(ctx.user!.id, input.workspaceId)
      return teamService.listMembers(input.workspaceId)
    }),

  listInvitations: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await wsQuery(ctx.user!.id, input.workspaceId)
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user!.id } },
      })
      if (!member || member.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Action réservée au propriétaire" })
      }
      return teamService.listInvitations(input.workspaceId)
    }),

  invite: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email("Email invalide"),
        role: RoleEnum.exclude(["OWNER"]).default("EDITOR"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await wsQuery(ctx.user!.id, input.workspaceId)
      return teamService.invite(input.workspaceId, input.email, input.role, ctx.user!.id)
    }),

  acceptInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Vous devez être connecté" })
      }
      return teamService.acceptInvitation(input.token, ctx.user.id)
    }),

  updateMemberRole: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
        role: RoleEnum.exclude(["OWNER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await wsQuery(ctx.user!.id, input.workspaceId)
      return teamService.updateMemberRole(input.workspaceId, input.userId, input.role, ctx.user!.id)
    }),

  removeMember: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await wsQuery(ctx.user!.id, input.workspaceId)
      return teamService.removeMember(input.workspaceId, input.userId, ctx.user!.id)
    }),
})
