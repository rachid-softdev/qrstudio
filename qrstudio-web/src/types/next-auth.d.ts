import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      plan: string
      needsTotp?: boolean
      partialToken?: string
      totpEnabled?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    plan?: string
    partialToken?: string
    needsTotp?: boolean
    totpEnabled?: boolean
    totpVerified?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    plan: string
    totpEnabled?: boolean
    totpVerified?: boolean
    needsTotp?: boolean
    partialToken?: string
  }
}
