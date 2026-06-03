"use client"

import { useState } from "react"
import { DownloadIcon, ImageIcon, FileTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface ExportPanelProps {
  qrName: string
  onNameChange: (name: string) => void
  onCreate: () => void
  onExportPng?: () => void
  onExportSvg?: () => void
  onExportPdf?: () => void
  canExport: boolean
  loading?: boolean
}

export function ExportPanel({
  qrName,
  onNameChange,
  onCreate,
  onExportPng,
  onExportSvg,
  onExportPdf,
  canExport,
  loading,
}: ExportPanelProps) {
  const [nameError, setNameError] = useState<string | null>(null)

  function handleNameChange(value: string) {
    if (value.length > 100) {
      setNameError("Le nom ne doit pas dépasser 100 caractères")
    } else {
      setNameError(null)
    }
    onNameChange(value)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="qr-name">Nom du QR code</Label>
        <Input
          id="qr-name"
          placeholder="Mon QR code"
          value={qrName}
          onChange={(e) => handleNameChange(e.target.value)}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Export</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport}
            onClick={onExportPng}
          >
            <ImageIcon className="size-4" />
            PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport}
            onClick={onExportSvg}
          >
            <FileTextIcon className="size-4" />
            SVG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport}
            onClick={onExportPdf}
          >
            <DownloadIcon className="size-4" />
            PDF
          </Button>
        </div>
        {!canExport && (
          <p className="text-xs text-muted-foreground">
            Exportez après avoir créé le QR code
          </p>
        )}
      </div>

      <Separator />

      <Button
        type="button"
        className="w-full"
        size="lg"
        disabled={!qrName.trim() || loading}
        onClick={onCreate}
      >
        {loading ? "Création en cours..." : "Créer le QR code"}
      </Button>
    </div>
  )
}
