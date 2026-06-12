"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CreditCardIcon, ArrowRightIcon } from "lucide-react"
import { api } from "@/lib/trpc/client"
import { PlanCard } from "@/components/billing/plan-card"
import { PLAN_LIMITS } from "@/lib/constants"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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
  const [dialogPlan, setDialogPlan] = useState<"PRO" | "AGENCY" | null>(null)

  const checkoutMutation = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
    onError: (err) => {
      toast.error(err.message)
      setDialogPlan(null)
    },
  })

  function handleConfirmPlan() {
    if (!dialogPlan) return
    const successUrl = `${window.location.origin}/dashboard/billing?success=true`
    const cancelUrl = `${window.location.origin}/dashboard/billing?canceled=true`
    checkoutMutation.mutate({ plan: dialogPlan, successUrl, cancelUrl })
  }

  const pendingPlanData = dialogPlan
    ? PLANS.find((p) => p.key === dialogPlan)
    : null

  return (
    <>
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
              isLoading={false}
              onSelect={() => {
                if (plan.key !== "FREE") {
                  setDialogPlan(plan.key)
                }
              }}
            />
          )
        })}
      </div>

      <Dialog open={dialogPlan !== null} onOpenChange={(open) => { if (!open) setDialogPlan(null) }}>
        <DialogContent className="sm:max-w-md">
          {checkoutMutation.isPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Redirection vers Stripe…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Préparation de votre session de paiement sécurisée
                </p>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCardIcon className="size-5 text-primary" />
                </div>
                <DialogTitle className="text-center">
                  Passer au plan {pendingPlanData?.name}
                </DialogTitle>
                <DialogDescription className="text-center">
                  Vous allez être redirigé vers Stripe pour finaliser votre paiement.
                </DialogDescription>
              </DialogHeader>

              {pendingPlanData && (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">{pendingPlanData.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tarif</span>
                    <span className="font-medium">{pendingPlanData.price}/mois</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogPlan(null)}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmPlan}
                >
                  Continuer vers Stripe
                  <ArrowRightIcon className="ml-1.5 size-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
