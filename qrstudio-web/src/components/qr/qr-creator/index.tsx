"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { QRType } from "@/types/index"
import type { ModuleShape } from "@/lib/qr-generator"
import { Separator } from "@/components/ui/separator"
import { StepIndicator } from "./step-indicator"
import { QRPreview } from "./qr-preview"
import { QRCreatorStepper } from "./qr-creator-stepper"
import { api } from "@/lib/trpc/client"

const STEPS = [
  { label: "Type" },
  { label: "Contenu" },
  { label: "Design" },
  { label: "Finaliser" },
]

function computeQRData(type: QRType, content: Record<string, unknown>): string {
  switch (type) {
    case "URL":
      return (content.destinationUrl as string) ?? ""
    case "WHATSAPP": {
      const phone = (content.destinationUrl as string) ?? ""
      return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`
    }
    case "WIFI": {
      const wifi = content.wifi as { ssid?: string; password?: string; encryption?: string } | undefined
      if (!wifi?.ssid) return ""
      return `WIFI:T:${wifi.encryption ?? "nopass"};S:${wifi.ssid};${wifi.password ? `P:${wifi.password};` : ""}`
    }
    case "VCARD": {
      const vcard = content.vcard as { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; website?: string } | undefined
      if (!vcard?.firstName && !vcard?.lastName) return ""
      const lines = ["BEGIN:VCARD", "VERSION:3.0"]
      if (vcard.firstName || vcard.lastName) {
        lines.push(`FN:${vcard.firstName ?? ""} ${vcard.lastName ?? ""}`.trim())
        lines.push(`N:${vcard.lastName ?? ""};${vcard.firstName ?? ""};;;`)
      }
      if (vcard.email) lines.push(`EMAIL:${vcard.email}`)
      if (vcard.phone) lines.push(`TEL:${vcard.phone}`)
      if (vcard.company) lines.push(`ORG:${vcard.company}`)
      if (vcard.website) lines.push(`URL:${vcard.website}`)
      lines.push("END:VCARD")
      return lines.join("\n")
    }
    case "PDF":
      return (content.destinationUrl as string) ?? ""
    case "TEXT":
      return (content.textContent as string) ?? ""
    case "LANDING_PAGE":
      return `page_${Date.now()}`
  }
}

interface QRCreatorProps {
  workspaceId: string
}

export function QRCreator({ workspaceId }: QRCreatorProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<QRType | null>(null)
  const [content, setContent] = useState<Record<string, unknown>>({})
  const [qrName, setQrName] = useState("")
  const [design, setDesign] = useState({
    fgColor: "#000000",
    bgColor: "#FFFFFF",
    moduleShape: "square" as ModuleShape,
    frameType: null as string | null,
    frameLabel: "",
    logoUrl: null as string | null,
  })
  const [loading, setLoading] = useState(false)

  const createMutation = api.qr.create.useMutation()

  const qrData = selectedType ? computeQRData(selectedType, content) : ""

  async function handleCreate() {
    if (!selectedType || !qrName.trim()) return

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        workspaceId,
        name: qrName.trim(),
        type: selectedType,
        ...content,
        fgColor: design.fgColor,
        bgColor: design.bgColor,
        moduleShape: design.moduleShape,
        frameType: design.frameType,
        frameLabel: design.frameLabel || undefined,
        logoUrl: design.logoUrl,
      }

      if (!payload.destinationUrl && !(content.wifi || content.vcard || content.textContent || content.landingPage)) {
        delete payload.destinationUrl
      }

      await createMutation.mutateAsync(payload as Parameters<typeof createMutation.mutateAsync>[0])
      toast.success("QR code créé avec succès !")
      router.push("/dashboard/qr-codes")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <StepIndicator currentStep={step} steps={STEPS} />

      <Separator />

      <div className="grid gap-8 lg:grid-cols-2">
        <QRCreatorStepper
          step={step}
          onStepChange={setStep}
          selectedType={selectedType}
          onTypeSelect={(type) => {
            setSelectedType(type)
            setContent({})
          }}
          content={content}
          onContentChange={setContent}
          design={design}
          onDesignChange={setDesign}
          qrName={qrName}
          onQrNameChange={setQrName}
          qrData={qrData}
          loading={loading}
          onCreate={handleCreate}
        />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Aperçu</h3>
          <QRPreview
            data={qrData}
            fgColor={design.fgColor}
            bgColor={design.bgColor}
            moduleShape={design.moduleShape}
          />
        </div>
      </div>
    </div>
  )
}
