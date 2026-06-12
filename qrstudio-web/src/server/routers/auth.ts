import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { publicProcedure, protectedProcedure, router } from "@/server/trpc"
import { authService } from "@/server/services/auth.service"
import { checkRegisterRateLimit } from "@/lib/rate-limit"
import { getClientIp } from "@/lib/ip"

/**
 * Extrait l'adresse IP du client à partir des en-têtes de la requête.
 * Délègue à getClientIp() pour une extraction fiable (proxy-aware).
 */
function extractClientIp(reqHeaders?: Record<string, string>): string | undefined {
  if (!reqHeaders) return undefined
  const headers = new Headers()
  for (const [key, value] of Object.entries(reqHeaders)) {
    headers.set(key, value)
  }
  const ip = getClientIp({ headers })
  return ip === "unknown" ? undefined : ip
}

const registerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
})

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  image: z.string().url().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
})

const verifyTotpSchema = z.object({
  token: z.string().length(6, "Le code doit contenir 6 caractères"),
})

const verifyChallengeSchema = z.object({
  partialToken: z.string(),
  token: z.string().length(6, "Le code doit contenir 6 caractères"),
})

const verifyBackupCodeSchema = z.object({
  partialToken: z.string(),
  backupCode: z.string().length(8, "Le code de secours doit contenir 8 caractères"),
})

const disableTotpSchema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
})

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
    const clientIp = extractClientIp(ctx.reqHeaders)
    if (clientIp) {
      const { success } = await checkRegisterRateLimit(clientIp)
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Trop de tentatives d'inscription. Réessayez dans une heure.",
        })
      }
    }
    return authService.register(input)
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.updateProfile(ctx.user.id, input)
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.changePassword(ctx.user.id, input.currentPassword, input.newPassword)
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    return authService.deleteAccount(ctx.user.id)
  }),

  // ─── TOTP ──────────────────────────────────────────────────────────────────

  generateTotpSetup: protectedProcedure.query(async ({ ctx }) => {
    return authService.generateTotpSetup(ctx.user.id)
  }),

  verifyAndEnableTotp: protectedProcedure
    .input(verifyTotpSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.verifyAndEnableTotp(ctx.user.id, input.token)
    }),

  verifyTotpChallenge: publicProcedure
    .input(verifyChallengeSchema)
    .mutation(async ({ ctx, input }) => {
      const clientIp = extractClientIp(ctx.reqHeaders)
      return authService.verifyTotpChallenge(input.partialToken, input.token, clientIp)
    }),

  verifyBackupCode: publicProcedure
    .input(verifyBackupCodeSchema)
    .mutation(async ({ ctx, input }) => {
      const clientIp = extractClientIp(ctx.reqHeaders)
      return authService.verifyBackupCode(input.partialToken, input.backupCode, clientIp)
    }),

  disableTotp: protectedProcedure
    .input(disableTotpSchema)
    .mutation(async ({ ctx, input }) => {
      return authService.disableTotp(ctx.user.id, input.password)
    }),

  // ─── Password Reset ─────────────────────────────────────────────────────────

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email("Email invalide") }))
    .mutation(async ({ input }) => {
      return authService.requestPasswordReset(input.email)
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1, "Token requis"),
      newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    }))
    .mutation(async ({ input }) => {
      return authService.resetPassword(input.token, input.newPassword)
    }),
})
