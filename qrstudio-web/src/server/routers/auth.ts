import { z } from "zod"
import { publicProcedure, protectedProcedure, router } from "@/server/trpc"
import { authService } from "@/server/services/auth.service"

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
})
