"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDownIcon } from "lucide-react"
import type { QRType } from "@/types/index"
import type { QRCreateInput } from "@/lib/validations"
import type { ModuleShape } from "@/lib/qr-generator"
import { computeQRData } from "@/lib/qr-utils"
import { cn } from "@/lib/utils"
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

interface QRCreatorProps {
  workspaceId: string
}

export function QRCreator({ workspaceId }: QRCreatorProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<QRType | null>(null)
  const [content, setContent] = useState<Partial<QRCreateInput>>({})
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
  const [createdQrId, setCreatedQrId] = useState<string | null>(null)
  const [createdShortCode, setCreatedShortCode] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const utils = api.useUtils()
  const createMutation = api.qr.create.useMutation()

  const qrData = selectedType ? computeQRData(selectedType, content) : ""

  async function handleCreate() {
    if (!selectedType || !qrName.trim()) return

    setLoading(true)
    try {
      const payload: QRCreateInput = {
        workspaceId,
        name: qrName.trim(),
        type: selectedType,
        ...content,
        fgColor: design.fgColor,
        bgColor: design.bgColor,
        moduleShape: design.moduleShape,
        frameType: (design.frameType as QRCreateInput["frameType"]) ?? undefined,
        frameLabel: design.frameLabel || undefined,
        logoUrl: design.logoUrl ?? undefined,
      }

      const result = await createMutation.mutateAsync(payload)
      setCreatedQrId(result.id)
      setCreatedShortCode(result.shortCode)
      toast.success("QR code créé avec succès !")
      router.push(`/dashboard/qr/${result.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la création"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPng = useCallback(async () => {
    if (!createdQrId) {
      toast.error("Créez d'abord un QR code")
      return
    }
    try {
      const result = await utils.client.qr.exportPng.query({ id: createdQrId, workspaceId, size: 800 })
      const link = document.createElement("a")
      link.download = `qr-${createdShortCode}.png`
      link.href = `data:image/png;base64,${result.base64}`
      link.click()
      toast.success("QR code exporté en PNG")
    } catch {
      toast.error("Échec de l'export PNG")
    }
  }, [createdQrId, createdShortCode, workspaceId, utils])

  const handleExportSvg = useCallback(async () => {
    if (!createdQrId) {
      toast.error("Créez d'abord un QR code")
      return
    }
    try {
      const result = await utils.client.qr.exportSvg.query({ id: createdQrId, workspaceId })
      const link = document.createElement("a")
      link.download = `qr-${createdShortCode}.svg`
      link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`
      link.click()
      toast.success("QR code exporté en SVG")
    } catch {
      toast.error("Échec de l'export SVG")
    }
  }, [createdQrId, createdShortCode, workspaceId, utils])

  const handleExportPdf = useCallback(async () => {
    if (!createdQrId) {
      toast.error("Créez d'abord un QR code")
      return
    }
    try {
      const result = await utils.client.qr.exportPdf.query({ id: createdQrId, workspaceId })
      const link = document.createElement("a")
      link.download = `qr-${createdShortCode}.pdf`
      link.href = `data:application/pdf;base64,${result.base64}`
      link.click()
      toast.success("QR code exporté en PDF")
    } catch {
      toast.error("Échec de l'export PDF")
    }
  }, [createdQrId, createdShortCode, workspaceId, utils])

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
          canExport={createdQrId !== null}
          onExportPng={handleExportPng}
          onExportSvg={handleExportSvg}
          onExportPdf={handleExportPdf}
        />

        {/* Desktop: always visible */}
        <div className="hidden space-y-4 lg:block">
          <h3 className="text-sm font-medium text-muted-foreground">Aperçu</h3>
          <QRPreview
            data={qrData}
            fgColor={design.fgColor}
            bgColor={design.bgColor}
            moduleShape={design.moduleShape}
          />
        </div>

        {/* Mobile: collapsible accordion */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showPreview}
            aria-controls="mobile-preview"
          >
            Aperçu
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                showPreview && "rotate-180"
              )}
            />
          </button>
          {showPreview && (
            <div id="mobile-preview" className="mt-4">
              <QRPreview
                data={qrData}
                fgColor={design.fgColor}
                bgColor={design.bgColor}
                moduleShape={design.moduleShape}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
