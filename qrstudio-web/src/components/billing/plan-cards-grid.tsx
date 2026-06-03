"use client"

import { toast } from "sonner"
import { api } from "@/lib/trpc/client"
import { PlanCard } from "@/components/billing/plan-card"
import { PLAN_LIMITS } from "@/lib/constants"

interface PlanCardsGridProps {
  currentPlan: string
}

const PLANS = [
  {
    key: "FREE" as const,
    name: "Gratuit",
    price: "Gratuit",
    description: "Pour démarrer avec les QR codes dynamiques",
    features: [
      { text: `Jusqu'à ${PLAN_LIMITS.FREE.maxQRCodes} QR codes`, included: true },
      { text: `${PLAN_LIMITS.FREE.maxTeamMembers} membre`, included: true },
      { text: `Analytiques sur ${PLAN_LIMITS.FREE.analyticsRetentionDays} jours`, included: true },
      { text: "Génération en masse", included: PLAN_LIMITS.FREE.bulkGeneration },
      { text: "Accès API", included: PLAN_LIMITS.FREE.apiAccess },
      { text: "Domaine personnalisé", included: PLAN_LIMITS.FREE.customDomain },
    ],
  },
  {
    key: "PRO" as const,
    name: "Pro",
    price: "19 €",
    description: "Pour les professionnels et les équipes",
    features: [
      { text: `Jusqu'à ${PLAN_LIMITS.PRO.maxQRCodes} QR codes`, included: true },
      { text: `Jusqu'à ${PLAN_LIMITS.PRO.maxTeamMembers} membres`, included: true },
      { text: `Analytiques sur ${PLAN_LIMITS.PRO.analyticsRetentionDays} jours`, included: true },
      { text: "Génération en masse", included: PLAN_LIMITS.PRO.bulkGeneration },
      { text: "Accès API", included: PLAN_LIMITS.PRO.apiAccess },
      { text: "Domaine personnalisé", included: PLAN_LIMITS.PRO.customDomain },
    ],
  },
  {
    key: "AGENCY" as const,
    name: "Agency",
    price: "79 €",
    description: "Pour les agences et gros volumes",
    features: [
      { text: "QR codes illimités", included: true },
      { text: "Membres illimités", included: true },
      { text: "Analytiques illimitées", included: true },
      { text: "Génération en masse", included: PLAN_LIMITS.AGENCY.bulkGeneration },
      { text: "Accès API", included: PLAN_LIMITS.AGENCY.apiAccess },
      { text: "Domaine personnalisé", included: PLAN_LIMITS.AGENCY.customDomain },
    ],
  },
]

export function PlanCardsGrid({ currentPlan }: PlanCardsGridProps) {
  const checkoutMutation = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
    onError: (err) => toast.error(err.message),
  })

  function handleSelectPlan(plan: "PRO" | "AGENCY") {
    const successUrl = `${window.location.origin}/dashboard/billing?success=true`
    const cancelUrl = `${window.location.origin}/dashboard/billing?canceled=true`
    checkoutMutation.mutate({ plan, successUrl, cancelUrl })
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.key
        const isFree = plan.key === "FREE"

        return (
          <PlanCard
            key={plan.key}
            name={plan.name}
            price={plan.price}
            description={plan.description}
            features={plan.features}
            ctaLabel={
              isCurrent
                ? "Plan actuel"
                : isFree
                  ? "Gratuit"
                  : `Passer à ${plan.name}`
            }
            highlighted={plan.key === "PRO"}
            disabled={isCurrent || isFree}
            isLoading={checkoutMutation.isPending}
            onSelect={() => {
              if (plan.key !== "FREE") {
                handleSelectPlan(plan.key)
              }
            }}
          />
        )
      })}
    </div>
  )
}
