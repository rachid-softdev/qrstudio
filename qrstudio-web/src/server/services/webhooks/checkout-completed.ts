import { z } from "zod"
import type Stripe from "stripe"
import type { PrismaTx } from "../billing.service"

const checkoutSchema = z.object({
  userId: z.string(),
  plan: z.enum(["FREE", "PRO", "AGENCY"]),
})

export async function handleCheckoutCompleted(event: Stripe.Event, tx: PrismaTx): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Stripe SDK typing limitation
  const session = event.data.object as Stripe.Checkout.Session
  const meta = checkoutSchema.safeParse(session.metadata)
  if (!meta.success) return

  const { userId, plan } = meta.data
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined
  if (!subscriptionId) return

  await tx.user.update({
    where: { id: userId },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
    },
  })
}
