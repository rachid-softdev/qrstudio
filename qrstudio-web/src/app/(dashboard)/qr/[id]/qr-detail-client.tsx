"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { QRDetailHeader } from "@/components/qr/qr-detail-header"
import { QRShortcodeInfo } from "@/components/qr/qr-shortcode-info"
import { QRVisualCard } from "@/components/qr/qr-visual-card"
import { AnalyticsSection } from "@/components/qr/analytics-section"
import { formatDate, formatNumber } from "@/lib/utils"
import { api } from "@/lib/trpc/client"
import type { QRCode, LandingPage, Scan } from "@prisma/client"
import type { AnalyticsData } from "@/types/index"

interface QRDetailClientProps {
  qrCode: QRCode & { landingPage: LandingPage | null; scans: Scan[] }
  workspaceId: string
  role: "OWNER" | "EDITOR" | "VIEWER"
  analyticsInitialData: AnalyticsData | null
  retentionDays: number | typeof Infinity
}

const typeLabels: Record<string, string> = {
  URL: "URL",
  WHATSAPP: "WhatsApp",
  WIFI: "Wi-Fi",
  VCARD: "vCard",
  PDF: "PDF",
  TEXT: "Texte",
  LANDING_PAGE: "Landing Page",
}

export function QRDetailClient({
  qrCode: initial,
  workspaceId,
  role,
  analyticsInitialData,
  retentionDays,
}: QRDetailClientProps) {
  const router = useRouter()
  const [qrCode, setQrCode] = useState(initial)

  const utils = api.useUtils()
  const updateStatusMutation = api.qr.updateStatus.useMutation()
  const deleteMutation = api.qr.delete.useMutation()

  async function handleToggleStatus() {
    try {
      const newStatus = qrCode.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
      await updateStatusMutation.mutateAsync({ id: qrCode.id, workspaceId, status: newStatus })
      setQrCode((prev) => ({ ...prev, status: newStatus }))
      toast.success(`QR code ${newStatus === "ACTIVE" ? "activé" : "mis en pause"}`)
      utils.qr.list.invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ id: qrCode.id, workspaceId })
      toast.success("QR code supprimé")
      router.push("/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Retour" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <QRDetailHeader
          id={qrCode.id}
          name={qrCode.name}
          type={qrCode.type}
          status={qrCode.status}
          createdAt={qrCode.createdAt}
          role={role}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
          isToggling={updateStatusMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRShortcodeInfo shortCode={qrCode.shortCode} />

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Code court</p>
                  <p className="font-mono text-sm">{qrCode.shortCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="text-sm">
                    {typeLabels[qrCode.type] ?? qrCode.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scans totaux</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(qrCode.totalScans)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scans uniques</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(qrCode.uniqueScans)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <QRVisualCard
            qrCodeId={qrCode.id}
            workspaceId={workspaceId}
            shortCode={qrCode.shortCode}
            name={qrCode.name}
          />

          <Card>
            <CardHeader>
              <CardTitle>Derniers scans</CardTitle>
            </CardHeader>
            <CardContent>
              {qrCode.scans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun scan pour le moment
                </p>
              ) : (
                <div className="space-y-2">
                  {qrCode.scans.slice(0, 5).map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {scan.country ?? "Inconnu"} · {scan.deviceType ?? "?"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(new Date(scan.scannedAt))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnalyticsSection
        qrId={qrCode.id}
        workspaceId={qrCode.workspaceId}
        initialData={analyticsInitialData ?? undefined}
        retentionDays={retentionDays}
      />
    </div>
  )
}
