"use client"

import { useState } from "react"
import { ScanIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PeriodSelector } from "@/components/qr/period-selector"
import { ScansChart } from "@/components/qr/scans-chart"
import { CountryTable } from "@/components/qr/country-table"
import { DeviceChart } from "@/components/qr/device-chart"
import { OSChart } from "@/components/qr/os-chart"
import { ExportCSVButton } from "@/components/qr/export-csv-button"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/loading-skeleton"
import { useAnalytics } from "@/hooks/use-analytics"
import { formatNumber } from "@/lib/utils"
import type { Period } from "@/lib/validations"
import type { AnalyticsData } from "@/types/index"

interface AnalyticsSectionProps {
  qrId: string
  workspaceId: string
  initialData?: AnalyticsData
  retentionDays: number | typeof Infinity
}

export function AnalyticsSection({
  qrId,
  workspaceId,
  initialData,
  retentionDays,
}: AnalyticsSectionProps) {
  const [period, setPeriod] = useState<Period>("30d")
  const { data, isLoading, error } = useAnalytics(qrId, workspaceId, period)
  const analytics = data ?? initialData

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Analytics</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Rétention :{" "}
              {retentionDays === Infinity
                ? "Illimitée"
                : `${retentionDays} jours`}
            </span>
            <PeriodSelector value={period} onChange={setPeriod} />
            {analytics && (
              <ExportCSVButton qrCodeId={qrId} workspaceId={workspaceId} period={period} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !analytics ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center text-sm text-destructive">
            Erreur lors du chargement des analytics
          </div>
        ) : !analytics || analytics.totalScans === 0 ? (
          <EmptyState
            icon={ScanIcon}
            title="En attente des premiers scans"
            description="Partagez votre QR code pour commencer à collecter des données."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Scans totaux</p>
                <p className="text-xl font-bold">
                  {formatNumber(analytics.totalScans)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Scans uniques</p>
                <p className="text-xl font-bold">
                  {formatNumber(analytics.uniqueScans)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Pays</p>
                <p className="text-xl font-bold">
                  {analytics.byCountry.length}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Appareils</p>
                <p className="text-xl font-bold">
                  {analytics.byDevice.reduce((a, b) => a + b.scans, 0)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium">Évolution des scans</h3>
              <ScansChart data={analytics.scansByDay} />
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-medium">Top 10 pays</h3>
                <CountryTable data={analytics.byCountry} />
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Appareils</h3>
                  <DeviceChart data={analytics.byDevice} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-medium">
                    Systèmes d&apos;exploitation
                  </h3>
                  <OSChart data={analytics.byOs} />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
