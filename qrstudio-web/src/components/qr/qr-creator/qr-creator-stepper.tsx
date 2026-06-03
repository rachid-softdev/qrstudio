"use client"

import { useCallback } from "react"
import type { QRType } from "@/types/index"
import type { ModuleShape } from "@/lib/qr-generator"
import { Button } from "@/components/ui/button"
import { TypeSelector } from "./type-selector"
import { ContentForm } from "./content-form"
import { DesignEditor } from "./design-editor"
import { ExportPanel } from "./export-panel"

interface DesignState {
  fgColor: string
  bgColor: string
  moduleShape: ModuleShape
  frameType: string | null
  frameLabel: string
  logoUrl: string | null
}

interface QRCreatorStepperProps {
  step: number
  onStepChange: (step: number | ((prev: number) => number)) => void
  selectedType: QRType | null
  onTypeSelect: (type: QRType | null) => void
  content: Record<string, unknown>
  onContentChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  design: DesignState
  onDesignChange: React.Dispatch<React.SetStateAction<DesignState>>
  qrName: string
  onQrNameChange: (name: string) => void
  qrData: string
  loading: boolean
  onCreate: () => Promise<void>
}

function canGoNext(
  step: number,
  selectedType: QRType | null,
  content: Record<string, unknown>,
): boolean {
  if (step === 1) return selectedType !== null
  if (step === 2) {
    if (!selectedType) return false
    if (selectedType === "URL") return !!(content.destinationUrl as string)
    if (selectedType === "WHATSAPP") return !!(content.destinationUrl as string)
    if (selectedType === "WIFI") {
      const wifi = content.wifi as { ssid?: string } | undefined
      return !!wifi?.ssid
    }
    if (selectedType === "VCARD") {
      const vcard = content.vcard as { firstName?: string; lastName?: string } | undefined
      return !!(vcard?.firstName || vcard?.lastName)
    }
    if (selectedType === "TEXT") return !!(content.textContent as string)
    if (selectedType === "PDF") return !!(content.destinationUrl as string)
    if (selectedType === "LANDING_PAGE") {
      const lp = content.landingPage as { title?: string } | undefined
      return !!lp?.title
    }
    return false
  }
  return true
}

export function QRCreatorStepper({
  step,
  onStepChange,
  selectedType,
  onTypeSelect,
  content,
  onContentChange,
  design,
  onDesignChange,
  qrName,
  onQrNameChange,
  qrData,
  loading,
  onCreate,
}: QRCreatorStepperProps) {
  const goNext = useCallback(() => {
    onStepChange((s) => Math.min(4, s + 1))
  }, [onStepChange])

  const goPrev = useCallback(() => {
    onStepChange((s) => Math.max(1, s - 1))
  }, [onStepChange])

  return (
    <div className="space-y-6">
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choisissez le type de QR code</h2>
          <TypeSelector
            selected={selectedType}
            onSelect={(type) => {
              onTypeSelect(type)
              onContentChange({})
            }}
          />
        </div>
      )}

      {step === 2 && selectedType && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Contenu du QR code</h2>
          <ContentForm
            type={selectedType}
            onChange={(data) => onContentChange((prev) => ({ ...prev, ...data }))}
            values={content}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Personnalisation</h2>
          <DesignEditor
            {...design}
            onChange={onDesignChange}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Finaliser</h2>
          <ExportPanel
            qrName={qrName}
            onNameChange={onQrNameChange}
            onCreate={onCreate}
            canExport={!!(qrName.trim() && qrData)}
            loading={loading}
          />
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={goPrev}
        >
          Précédent
        </Button>
        {step < 4 ? (
          <Button
            type="button"
            disabled={!canGoNext(step, selectedType, content)}
            onClick={goNext}
          >
            Suivant
          </Button>
        ) : null}
      </div>
    </div>
  )
}
