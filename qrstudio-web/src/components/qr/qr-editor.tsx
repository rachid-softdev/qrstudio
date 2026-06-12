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
import type { QRCreateInput } from "@/lib/validations"
import type { ModuleShape } from "@/lib/qr-generator"

interface QREditorProps {
  qrCode: {
    id: string
    name: string
    type: QRType
    metadata: unknown
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

  const [content, setContent] = useState<Partial<QRCreateInput>>(() => {
    const meta = qrCode.metadata as Record<string, unknown> | null
    return {
      destinationUrl: (meta?.destinationUrl as string | undefined) ?? "",
      ...(qrCode.type === "WIFI"
        ? { wifi: (meta?.wifi as QRCreateInput["wifi"]) ?? { ssid: "", encryption: "nopass" as const } }
        : {}),
      ...(qrCode.type === "VCARD"
        ? { vcard: (meta?.vcard as QRCreateInput["vcard"]) ?? {} }
        : {}),
      ...(qrCode.type === "TEXT"
        ? { textContent: (meta?.textContent as string | undefined) ?? "" }
        : {}),
    }
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
      const payload: Parameters<typeof updateMutation.mutateAsync>[0] = {
        id: qrCode.id,
        name: qrCode.name,
        ...content,
        fgColor: design.fgColor,
        bgColor: design.bgColor,
        moduleShape: design.moduleShape,
        frameType: design.frameType ?? undefined,
        frameLabel: design.frameLabel || undefined,
        logoUrl: design.logoUrl ?? undefined,
      }

      await updateMutation.mutateAsync(payload)
      toast.success("QR code mis à jour")
      router.push(`/dashboard/qr/${qrCode.id}`)
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
