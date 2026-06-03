"use client"

import { CopyIcon, ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface QRShortcodeInfoProps {
  shortCode: string
}

export function QRShortcodeInfo({ shortCode }: QRShortcodeInfoProps) {
  const scanUrl = `${window.location.origin}/api/qr/${shortCode}`

  function handleCopyLink() {
    navigator.clipboard.writeText(scanUrl)
    toast.success("Lien copié dans le presse-papier")
  }

  function handleTest() {
    window.open(scanUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">URL de scan</p>
        <p className="truncate text-sm text-muted-foreground">{scanUrl}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <CopyIcon className="size-4" />
          Copier le lien
        </Button>
        <Button variant="outline" size="sm" onClick={handleTest}>
          <ExternalLinkIcon className="size-4" />
          Tester
        </Button>
      </div>
    </div>
  )
}
