import crypto from "crypto"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
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
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

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
        token.id = user.id as string
        token.csrfToken = crypto.randomUUID()
        if ((user as { needsTotp?: boolean }).needsTotp) {
          token.needsTotp = true
          token.partialToken = (user as { partialToken?: string }).partialToken
          // Don't query DB — user hasn't completed TOTP challenge yet
          return token
        }
        token.plan = (user as { plan?: string }).plan ?? "FREE"
        // Normal signIn — user object has all we need, skip DB sync
        return token
      }

      // On token refresh (user undefined), sync from DB
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
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
      if (session.user) {
        session.user.id = token.id as string
        session.user.plan = (token.plan as string) ?? "FREE"
        session.user.totpEnabled = (token.totpEnabled as boolean) ?? false
        session.user.needsTotp = (token.needsTotp as boolean) ?? false
        session.user.partialToken = token.partialToken as string | undefined
      }
      session.csrfToken = token.csrfToken as string | undefined
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
