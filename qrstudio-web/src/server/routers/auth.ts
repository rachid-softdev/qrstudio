import { z } from "zod"
import { publicProcedure, protectedProcedure, router } from "@/server/trpc"
import { authService } from "@/server/services/auth.service"

/**
 * Extrait l'adresse IP du client à partir des en-têtes de la requête.
 * Utilise x-forwarded-for (proxy-aware) ou x-real-ip, avec fallback sur unknown.
 */
function extractClientIp(reqHeaders?: Record<string, string>): string | undefined {
  if (!reqHeaders) return undefined
  const forwarded = reqHeaders["x-forwarded-for"]
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? undefined
  }
  return reqHeaders["x-real-ip"] ?? undefined
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
  register: publicProcedure.input(registerSchema).mutation(async ({ input }) => {
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
})
