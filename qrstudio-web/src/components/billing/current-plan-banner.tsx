"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { CheckCircleIcon, AlertCircleIcon, ClockIcon } from "lucide-react"

interface CurrentPlanBannerProps {
  plan: string
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  PRO: "Pro",
  AGENCY: "Agency",
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-muted text-muted-foreground border border-border",
  PRO: "bg-primary/10 text-primary border border-primary/20",
  AGENCY: "bg-accent text-accent-foreground border border-accent",
}

export function CurrentPlanBanner({
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: CurrentPlanBannerProps) {
  const planLabel = PLAN_LABELS[plan] ?? plan

  function getStatusBadge() {
    if (plan === "FREE") {
      return (
        <Badge variant="outline" className="gap-1">
          <CheckCircleIcon className="size-3" />
          Actif
        </Badge>
      )
    }

    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircleIcon className="size-3" />
            Actif
          </Badge>
        )
      case "past_due":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircleIcon className="size-3" />
            Paiement en retard
          </Badge>
        )
      case "unavailable":
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircleIcon className="size-3" />
            Indisponible
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <ClockIcon className="size-3" />
            {status}
          </Badge>
        )
    }
  }

  return (
    <Card
      className={
        plan === "FREE"
          ? "border-dashed"
          : plan === "PRO"
            ? "border-primary/20"
            : "border-accent"
      }
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-0.5 text-sm font-semibold ${PLAN_COLORS[plan] ?? ""}`}
            >
              {planLabel}
            </span>
            {getStatusBadge()}
          </div>
          {cancelAtPeriodEnd && currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Abonnement annulé — se termine le{" "}
              {formatDate(currentPeriodEnd)}
            </p>
          )}
          {plan !== "FREE" && currentPeriodEnd && !cancelAtPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              Prochaine facturation le {formatDate(currentPeriodEnd)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
