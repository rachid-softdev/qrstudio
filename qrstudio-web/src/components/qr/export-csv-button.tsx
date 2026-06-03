"use client"

import { useState } from "react"
import { DownloadIcon, LoaderIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/trpc/client"
import { toast } from "sonner"
import type { Period } from "@/lib/validations"

interface ExportCSVButtonProps {
  qrCodeId: string
  workspaceId: string
  period: Period
}

export function ExportCSVButton({ qrCodeId, workspaceId, period }: ExportCSVButtonProps) {
  const [loading, setLoading] = useState(false)
  const utils = api.useUtils()

  async function handleExport() {
    setLoading(true)
    try {
      const result = await utils.client.qr.exportCsv.query({ qrCodeId, workspaceId, period })
      const blob = new Blob([result], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `qr-scans-${qrCodeId.slice(0, 8)}-${period}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Fichier CSV téléchargé")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'export"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? (
        <LoaderIcon className="size-4 animate-spin" />
      ) : (
        <DownloadIcon className="size-4" />
      )}
      Exporter CSV
    </Button>
  )
}
