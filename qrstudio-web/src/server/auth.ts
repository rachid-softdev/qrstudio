import crypto from "crypto"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/server/db"
import { authService } from "@/server/services/auth.service"
import { sleep } from "@/lib/utils"
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z.object({ email: z.string(), password: z.string() }).safeParse(credentials)
        if (!parsed.success) {
          return null
        }

        const { email, password } = parsed.data

        // Vérification lockout AVANT la recherche utilisateur
        // checkLockout lance TRPCError TOO_MANY_REQUESTS si verrouillé
        await authService.checkLockout(email)

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            plan: true,
            totpEnabled: true,
          },
        })

        if (!user || !user.passwordHash) {
          // Compte inexistant → on enregistre la tentative pour éviter
          // le scanning d'emails (timing attack partielle via lockout)
          await authService.recordFailedAttempt(email)
          await sleep(100) // 100ms ≈ temps d'un bcrypt.compare()
          return null
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          // Échec mot de passe → enregistrer la tentative
          await authService.recordFailedAttempt(email)
          return null
        }

        // Succès → réinitialiser le compteur
        await authService.resetLoginAttempts(email)

        // If TOTP enabled, return partial auth token instead of full session
        if (user.totpEnabled) {
          const partialToken = await authService.createPartialAuthToken(user.id)
          return {
            id: user.id,
            email: user.email,
            partialToken,
            needsTotp: true,
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          plan: user.plan,
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial signIn, set token from authorize return
      if (user) {
        const parsedUser = z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
          plan: z.string().optional(),
          needsTotp: z.boolean().optional(),
          partialToken: z.string().optional(),
        }).safeParse(user)

        if (!parsedUser.success) return token

        const u = parsedUser.data
        token.id = u.id
        token.csrfToken = crypto.randomUUID()
        if (u.needsTotp) {
          token.needsTotp = true
          token.partialToken = u.partialToken
          // Don't query DB — user hasn't completed TOTP challenge yet
          return token
        }
        token.plan = u.plan ?? "FREE"
        // Normal signIn — user object has all we need, skip DB sync
        return token
      }

      // On token refresh (user undefined), sync from DB
      if (token.id) {
        const parsedToken = z.object({
          id: z.string(),
        }).safeParse({ id: token.id })

        if (!parsedToken.success) return token

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: parsedToken.data.id },
            select: { plan: true, email: true, totpEnabled: true, totpVerifiedAt: true },
          })

          if (!dbUser) {
            // Utilisateur supprimé → invalider le token
            return null
          }

          token.plan = dbUser.plan
          token.email = dbUser.email
          token.totpEnabled = dbUser.totpEnabled

          // TOTP now verified in DB → clear partial auth state
          if (token.needsTotp && dbUser.totpVerifiedAt) {
            delete token.needsTotp
            delete token.partialToken
          }
        } catch {
          // DB unavailable — keep existing token values
        }
      }

      return token
    },
    async session({ session, token }) {
      const parsedToken = z.object({
        id: z.string(),
        plan: z.string().optional().default("FREE"),
        totpEnabled: z.boolean().optional().default(false),
        needsTotp: z.boolean().optional().default(false),
        partialToken: z.string().optional(),
        csrfToken: z.string().optional(),
      }).safeParse(token)

      if (session.user && parsedToken.success) {
        const t = parsedToken.data
        session.user.id = t.id
        session.user.plan = t.plan
        session.user.totpEnabled = t.totpEnabled
        session.user.needsTotp = t.needsTotp
        session.user.partialToken = t.partialToken
      }
      if (parsedToken.success) {
        session.csrfToken = parsedToken.data.csrfToken
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 5 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
