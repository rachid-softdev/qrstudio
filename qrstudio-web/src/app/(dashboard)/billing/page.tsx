import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { getStripeClient } from "@/lib/stripe"
import { Header } from "@/components/layout/header"
import { CurrentPlanBanner } from "@/components/billing/current-plan-banner"
import { PlanCardsGrid } from "@/components/billing/plan-cards-grid"
import { UsageMeter } from "@/components/billing/usage-meter"
import { CancelSubscription } from "@/components/billing/cancel-subscription"

export const metadata: Metadata = {
  title: "Facturation — QR Studio",
  description: "Gérez votre abonnement QR Studio",
}



export default async function BillingPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, plan: true, stripeSubscriptionId: true },
  })

  if (!user) {
    redirect("/login")
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  })

  let subscription = {
    plan: user.plan,
    status: "inactive" as string,
    currentPeriodEnd: null as Date | null,
    cancelAtPeriodEnd: false,
  }

  if (user.stripeSubscriptionId && user.plan !== "FREE") {
    try {
      const sub = await getStripeClient().subscriptions.retrieve(user.stripeSubscriptionId)
      const item = sub.items.data[0]
      subscription = {
        plan: user.plan,
        status: sub.status,
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      }
    } catch {
      subscription.status = "unavailable"
    }
  }

  let qrCodeCount = 0
  let memberCount = 0
  if (workspace) {
    qrCodeCount = await prisma.qRCode.count({ where: { workspaceId: workspace.id } })
    memberCount = await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } })
  }

  return (
    <div className="space-y-8">
      <Header
        title="Facturation"
        description="Gérez votre abonnement et suivez votre utilisation"
      />

      <CurrentPlanBanner
        plan={subscription.plan}
        status={subscription.status}
        currentPeriodEnd={subscription.currentPeriodEnd}
        cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
      />

      {subscription.plan === "FREE" && (
        <PlanCardsGrid currentPlan={subscription.plan} />
      )}

      <UsageMeter
        qrCodeCount={qrCodeCount}
        memberCount={memberCount}
        plan={subscription.plan}
      />

      {subscription.plan !== "FREE" && !subscription.cancelAtPeriodEnd && (
        <CancelSubscription />
      )}
    </div>
  )
}
