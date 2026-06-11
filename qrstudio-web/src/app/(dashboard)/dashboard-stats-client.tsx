"use client"

import Link from "next/link"
import { QrCodeIcon, ScanIcon, UsersIcon, BarChart3Icon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScansChart } from "@/components/qr/scans-chart"
import { formatNumber } from "@/lib/utils"
import type { DashboardStats } from "@/types/index"

interface DashboardStatsClientProps {
  initialData: DashboardStats
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardStatsClient({ initialData }: DashboardStatsClientProps) {
  const stats = initialData

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<QrCodeIcon className="size-4" />}
          label="QR codes"
          value={formatNumber(stats.totalQRCodes)}
        />
        <StatCard
          icon={<ScanIcon className="size-4" />}
          label="Scans total"
          value={formatNumber(
            stats.topQRCodes.reduce((acc, qr) => acc + qr.totalScans, 0)
          )}
        />
        <StatCard
          icon={<BarChart3Icon className="size-4" />}
          label="Scans aujourd&apos;hui"
          value={formatNumber(stats.totalScansToday)}
        />
        <StatCard
          icon={<UsersIcon className="size-4" />}
          label="Membres"
          value={formatNumber(stats.totalMembers)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scans des 7 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          <ScansChart data={stats.scansLast7Days} />
        </CardContent>
      </Card>

      {stats.topQRCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 QR codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topQRCodes.map((qr, index) => (
                <Link
                  key={qr.id}
                  href={`/dashboard/qr/${qr.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{qr.name}</p>
                      <p className="text-xs text-muted-foreground">
                        /{qr.shortCode}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatNumber(qr.totalScans)} scan
                    {qr.totalScans !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
