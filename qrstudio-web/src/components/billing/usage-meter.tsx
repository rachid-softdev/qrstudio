"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { QrCodeIcon, UsersIcon } from "lucide-react"
import { PLAN_LIMITS } from "@/lib/constants"
import type { Plan } from "@/types/index"

interface UsageMeterProps {
  qrCodeCount: number
  memberCount: number
  plan: string
}

export function UsageMeter({
  qrCodeCount,
  memberCount,
  plan,
}: UsageMeterProps) {
  const limits = PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.FREE

  function getPercentage(current: number, max: number | typeof Infinity): number {
    if (max === Infinity) return 0
    if (max === 0) return 100
    return Math.min(100, Math.round((current / max) * 100))
  }

  function getLabel(current: number, max: number | typeof Infinity): string {
    if (max === Infinity) return `${current} / Illimité`
    return `${current} / ${max}`
  }

  const qrPercentage = getPercentage(qrCodeCount, limits.maxQRCodes)
  const memberPercentage = getPercentage(memberCount, limits.maxTeamMembers)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Utilisation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <QrCodeIcon className="size-4 text-muted-foreground" />
              QR codes
            </span>
            <span className="font-medium">
              {getLabel(qrCodeCount, limits.maxQRCodes)}
            </span>
          </div>
          <Progress
            value={qrPercentage}
            className={qrPercentage >= 90 ? "[&>div]:bg-destructive" : ""}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              Membres de l&apos;équipe
            </span>
            <span className="font-medium">
              {getLabel(memberCount, limits.maxTeamMembers)}
            </span>
          </div>
          <Progress
            value={memberPercentage}
            className={memberPercentage >= 90 ? "[&>div]:bg-destructive" : ""}
          />
        </div>
      </CardContent>
    </Card>
  )
}
