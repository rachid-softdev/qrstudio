import type Stripe from "stripe"
import type { PrismaTx } from "../billing.service"
import { handleCheckoutCompleted } from "./checkout-completed"
import { handleSubscriptionUpdated } from "./subscription-updated"
import { handleSubscriptionDeleted } from "./subscription-deleted"

const handlers: Record<string, (event: Stripe.Event, tx: PrismaTx) => Promise<void>> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
}

export async function handleWebhookEvent(event: Stripe.Event, tx: PrismaTx): Promise<void> {
  const handler = handlers[event.type]
  if (handler) {
    await handler(event, tx)
  }
}
