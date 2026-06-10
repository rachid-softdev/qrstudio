import type Stripe from "stripe"
import type { Plan } from "@/types/index"
import type { PrismaTx } from "../billing.service"

export async function handleCheckoutCompleted(event: Stripe.Event, tx: PrismaTx): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session
  const userId = session.metadata?.userId
  const plan = session.metadata?.plan as Plan | undefined
  if (!userId || !plan) return

  await tx.user.update({
    where: { id: userId },
    data: {
      plan,
      stripeSubscriptionId: session.subscription as string,
    },
  })
}
