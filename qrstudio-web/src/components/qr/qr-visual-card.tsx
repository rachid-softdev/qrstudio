"use client"

import { DownloadIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/trpc/client"

interface QRVisualCardProps {
  qrCodeId: string
  workspaceId: string
  shortCode: string
  name: string
}

export function QRVisualCard({ qrCodeId, workspaceId, shortCode, name }: QRVisualCardProps) {
  const { data: svgData, isLoading: svgLoading } = api.qr.exportSvg.useQuery(
    { id: qrCodeId, workspaceId }
  )
  const exportPngQuery = api.qr.exportPng.useQuery(
    { id: qrCodeId, workspaceId, size: 800 },
    { enabled: false }
  )

  const currentSvg = svgData?.svg ?? null

  async function handleDownloadPng() {
    const result = await exportPngQuery.refetch()
    if (result.data?.base64) {
      const link = document.createElement("a")
      link.download = `${name}.png`
      link.href = `data:image/png;base64,${result.data.base64}`
      link.click()
    }
  }

  function handleDownloadSvg() {
    if (!currentSvg) return
    const blob = new Blob([currentSvg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.download = `${name}.svg`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleDownloadPdf() {
    window.open(`/api/qr/${shortCode}/pdf`, "_blank")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aperçu</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          {svgLoading && !currentSvg ? (
            <div className="flex size-48 items-center justify-center text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : currentSvg ? (
            <div
              className="size-48"
              dangerouslySetInnerHTML={{ __html: currentSvg }}
            />
          ) : (
            <div className="flex size-48 items-center justify-center text-sm text-muted-foreground">
              QR Code
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="xs" onClick={handleDownloadPng}>
            <DownloadIcon className="size-3" />
            PNG
          </Button>
          <Button variant="outline" size="xs" onClick={handleDownloadSvg} disabled={!currentSvg}>
            <DownloadIcon className="size-3" />
            SVG
          </Button>
          <Button variant="outline" size="xs" onClick={handleDownloadPdf}>
            <DownloadIcon className="size-3" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
