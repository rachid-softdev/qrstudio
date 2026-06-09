import { z } from "zod"
import logger from "@/lib/logger"

const envSchema = z.object({
  // ─── Core ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET doit contenir au moins 32 caractères"),
  DATABASE_URL: z.string().url("DATABASE_URL doit être une URL valide"),

  // ─── Auth providers ────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ─── Stripe ────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // ─── Resend (email) ────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),

  // ─── Upstash ───────────────────────────────────────────────────────────────
  UPSTASH_REDIS_URL: z.string().url("UPSTASH_REDIS_URL doit être une URL valide").optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // ─── UploadThing ───────────────────────────────────────────────────────────
  UPLOADTHING_SECRET: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),

  // ─── Sentry ────────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // ─── App ──────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  VERCEL_URL: z.string().optional(),
  PORT: z.coerce.number().default(3000),
})

export type Env = z.infer<typeof envSchema>

/**
 * Valide les variables d'environnement critiques au démarrage.
 * Lève une erreur claire si une variable requise est manquante ou invalide.
 *
 * Appelée depuis db.ts (premier module chargé au runtime serveur).
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missingVars = result.error.issues
      .filter((issue) => issue.message.includes("Required"))
      .map((issue) => issue.path.join("."))

    const summary = missingVars.length > 0
      ? `Variables d'environnement manquantes : ${missingVars.join(", ")}`
      : `Erreurs de validation : ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`

    logger.fatal("Validation des variables d'environnement échouée :")
    logger.fatal(result.error.toString())

    // En production, on utilise des defaults pour les valeurs optionnelles,
    // donc on ne bloque pas le démarrage — on logge seulement
    if (process.env.NODE_ENV === "production") {
      const criticalMissing = result.error.issues.filter(
        (issue) =>
          issue.message.includes("Required") &&
          ["NEXTAUTH_SECRET", "DATABASE_URL"].includes(issue.path.join(".")),
      )
      if (criticalMissing.length > 0) {
        throw new Error(summary)
      }
    }

    // Retourner un objet partiel avec les valeurs par défaut
    return envSchema.parse(process.env)
  }

  return result.data
}

// Singleton : valider une fois et mettre en cache
let _env: Env | null = null

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv()
  }
  return _env
}
