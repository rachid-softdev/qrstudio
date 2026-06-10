import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { z } from "zod"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import logger from "@/lib/logger"
import type { PrismaClient } from "@prisma/client"
import type { Logger } from "pino"

const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  plan: z.string().optional().default("FREE"),
  totpEnabled: z.boolean().optional().default(false),
})

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
  requestId?: string
  logger?: Logger
}

export async function createTRPCContext(opts?: { headers: Headers }): Promise<TRPCContext> {
  const session = await auth()

  const headers: Record<string, string> = {}
  if (opts?.headers) {
    opts.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
  }

  // Extract X-Request-ID from request headers or generate one.
  // Note: Next.js middleware sets X-Request-ID on the response, not the request,
  // so this will typically generate a fresh UUID per tRPC call.
  const requestId = headers["x-request-id"] ?? crypto.randomUUID()

  let user: TRPCContext["user"] = undefined
  if (session?.user) {
    const parsed = sessionUserSchema.safeParse(session.user)
    if (parsed.success) {
      user = {
        id: parsed.data.id,
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        image: parsed.data.image ?? null,
        plan: parsed.data.plan,
      }
    }
  }

  return {
    db: prisma,
    session,
    user,
    reqHeaders: headers,
    requestId,
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

/**
 * Middleware that attaches a child logger with the request correlation ID.
 * The child logger is available as `ctx.logger` in all downstream procedures.
 */
const logMiddleware = t.middleware(({ ctx, next }) => {
  const requestId = ctx.requestId ?? crypto.randomUUID()
  const childLogger = logger.child({ requestId })
  return next({
    ctx: {
      ...ctx,
      requestId,
      logger: childLogger,
    },
  })
})

/**
 * Procedure with a child logger scoped to the current request.
 * Use this when you need correlation IDs in your logs.
 */
export const loggedProcedure = t.procedure.use(logMiddleware)

/**
 * Authenticated + CSRF-protected procedure.
 * Includes the loggedProcedure middleware so all authenticated
 * routes automatically get request-scoped logging.
 */
export const protectedProcedure = loggedProcedure.use(enforceUserIsAuthed).use(csrfMiddleware)

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
