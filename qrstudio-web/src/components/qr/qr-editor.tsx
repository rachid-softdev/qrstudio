"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ContentForm } from "@/components/qr/qr-creator/content-form"
import { DesignEditor } from "@/components/qr/qr-creator/design-editor"
import { QRPreview } from "@/components/qr/qr-creator/qr-preview"
import { computeQRData } from "@/lib/qr-utils"
import { api } from "@/lib/trpc/client"
import type { QRType } from "@/types/index"
import type { ModuleShape } from "@/lib/qr-generator"

interface QREditorProps {
  qrCode: {
    id: string
    name: string
    type: QRType
    destinationUrl: string | null
    wifiSsid: string | null
    wifiPassword: string | null
    wifiEncryption: string | null
    vcardJson: string | null
    textContent: string | null
    fgColor: string
    bgColor: string
    moduleShape: string
    frameType: string | null
    frameLabel: string | null
    logoUrl: string | null
  }
}

export function QREditor({ qrCode }: QREditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("destination")

  const [content, setContent] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {
      destinationUrl: qrCode.destinationUrl ?? "",
    }
    if (qrCode.type === "WIFI") {
      base.wifi = {
        ssid: qrCode.wifiSsid ?? "",
        password: qrCode.wifiPassword ?? "",
        encryption: qrCode.wifiEncryption ?? "nopass",
      }
    }
    if (qrCode.type === "VCARD" && qrCode.vcardJson) {
      try {
        base.vcard = JSON.parse(qrCode.vcardJson)
      } catch {
        base.vcard = {}
      }
    }
    if (qrCode.type === "TEXT") {
      base.textContent = qrCode.textContent ?? ""
    }
    return base
  })

  const [design, setDesign] = useState({
    fgColor: qrCode.fgColor,
    bgColor: qrCode.bgColor,
    moduleShape: (qrCode.moduleShape ?? "square") as ModuleShape,
    frameType: qrCode.frameType,
    frameLabel: qrCode.frameLabel ?? "",
    logoUrl: qrCode.logoUrl,
  })

  const updateMutation = api.qr.update.useMutation()

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        id: qrCode.id,
        name: qrCode.name,
        ...content,
        ...design,
      }

      if (payload.frameLabel === "") payload.frameLabel = undefined
      if (!payload.destinationUrl && qrCode.type !== "WIFI" && qrCode.type !== "VCARD" && qrCode.type !== "TEXT") {
        delete payload.destinationUrl
      }

      await updateMutation.mutateAsync(payload as Parameters<typeof updateMutation.mutateAsync>[0])
      toast.success("QR code mis à jour")
      router.push(`/qr/${qrCode.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la mise à jour"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const qrPreviewData = computeQRData(qrCode.type, content)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Modifier le QR code</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="destination">Destination</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
            </TabsList>
            <TabsContent value="destination">
              <ContentForm
                type={qrCode.type}
                onChange={(data) => setContent((prev) => ({ ...prev, ...data }))}
                values={content}
              />
            </TabsContent>
            <TabsContent value="design">
              <DesignEditor
                {...design}
                onChange={setDesign}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
        <Separator />
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Aperçu</h3>
        <QRPreview
          data={qrPreviewData}
          fgColor={design.fgColor}
          bgColor={design.bgColor}
          moduleShape={design.moduleShape}
        />
      </div>
    </div>
  )
}
