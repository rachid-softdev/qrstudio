import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import type { PrismaClient } from "@prisma/client"

export interface TRPCContext {
  db: PrismaClient
  session: unknown
  user?: {
    id: string
    email: string
    name: string | null
    image: string | null
    plan: string
  }
  workspace?: {
    id: string
    slug: string
    role: string
  }
}

export async function createTRPCContext(): Promise<TRPCContext> {
  const session = await auth()

  return {
    db: prisma,
    session,
    user: session?.user
      ? {
          id: session.user.id as string,
          email: session.user.email as string,
          name: (session.user.name as string) ?? null,
          image: (session.user.image as string) ?? null,
          plan: (session.user.plan as string) ?? "FREE",
        }
      : undefined,
  }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

export const router = t.router
export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

export async function requireWorkspaceAccess(userId: string, workspaceId: string): Promise<{ id: string; role: string }> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })

  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès non autorisé à ce workspace" })
  }

  return { id: workspaceId, role: member.role }
}

export function requireRole(role: string, requiredRoles: string[]): void {
  if (!requiredRoles.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Action réservée aux rôles : ${requiredRoles.join(", ")}`,
    })
  }
}

// workspaceProcedure = protectedProcedure (garantit juste l'auth)
// La vérification workspace est faite via requireWorkspaceAccess() dans chaque procédure
export const workspaceProcedure = protectedProcedure
