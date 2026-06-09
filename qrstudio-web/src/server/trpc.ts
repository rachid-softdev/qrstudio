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
  reqHeaders?: Record<string, string>
}

export async function createTRPCContext(opts?: { headers: Headers }): Promise<TRPCContext> {
  const session = await auth()

  const headers: Record<string, string> = {}
  if (opts?.headers) {
    opts.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
  }

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
    reqHeaders: headers,
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

const csrfMiddleware = t.middleware(({ ctx, next, type }) => {
  if (type === 'query') {
    return next({ ctx })
  }

  const reqHeaders = (ctx as Record<string, unknown>).reqHeaders as Record<string, string> | undefined
  const headerToken = reqHeaders?.['x-csrf-token']
  const session = (ctx as Record<string, unknown>).session as { csrfToken?: string } | null | undefined

  // Authenticated mutations: validate against session CSRF token
  if (session?.csrfToken) {
    if (!headerToken || headerToken !== session.csrfToken) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Token CSRF manquant ou invalide',
      })
    }
    return next({ ctx })
  }

  // Unauthenticated mutations: validate via Origin header
  const origin = reqHeaders?.['origin']
  const host = reqHeaders?.['host']
  if (origin) {
    const allowedOrigin = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    const originHost = new URL(origin).host
    if (originHost !== (host ?? allowedOrigin.replace(/^https?:\/\//, ''))) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Requête cross-origin rejetée',
      })
    }
    return next({ ctx })
  }

  // No session and no Origin → reject mutation
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Token CSRF manquant',
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed).use(csrfMiddleware)

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
