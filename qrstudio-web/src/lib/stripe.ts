import Stripe from "stripe"

let client: Stripe | null = null

export function getStripeClient(): Stripe {
  if (client) return client

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in your .env file."
    )
  }

  client = new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
  })

  return client
}
