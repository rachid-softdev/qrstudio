"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

interface PlanFeature {
  text: string
  included: boolean
}

interface PlanCardProps {
  name: string
  price: string
  description: string
  features: PlanFeature[]
  ctaLabel: string
  highlighted?: boolean
  disabled?: boolean
  onSelect: () => void
  isLoading?: boolean
}

export function PlanCard({
  name,
  price,
  description,
  features,
  ctaLabel,
  highlighted,
  disabled,
  onSelect,
  isLoading,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        "relative flex flex-col",
        highlighted && "border-primary ring-2 ring-primary/20"
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Recommandé
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">{price}</span>
          {price !== "Gratuit" && (
            <span className="text-sm text-muted-foreground">/mois</span>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckIcon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  feature.included
                    ? "text-primary"
                    : "text-muted-foreground/40"
                )}
              />
              <span
                className={
                  feature.included ? "" : "text-muted-foreground/60"
                }
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={highlighted ? "default" : "outline"}
          disabled={disabled || isLoading}
          onClick={onSelect}
        >
          {isLoading ? "Redirection..." : ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
