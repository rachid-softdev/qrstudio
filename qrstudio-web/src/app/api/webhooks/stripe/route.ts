import Stripe from "stripe"
import { NextResponse } from "next/server"
import { billingService } from "@/server/services/billing.service"

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY non configuré")
  }
  return new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
  })
}

function getWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? ""
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = getWebhookSecret()

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Configuration webhook manquante" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json(
      { error: "Signature invalide" },
      { status: 400 }
    )
  }

  await billingService.handleWebhookEvent(event)

  return NextResponse.json({ received: true })
}
