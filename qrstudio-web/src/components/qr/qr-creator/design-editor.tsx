"use client"

import type { ModuleShape } from "@/lib/qr-generator"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ColorPicker } from "./color-picker"
import { ShapeSelector } from "./shape-selector"
import { FrameSelector } from "./frame-selector"
import { LogoUploader } from "./logo-uploader"

interface DesignEditorProps {
  fgColor: string
  bgColor: string
  moduleShape: ModuleShape
  frameType: string | null
  frameLabel: string
  logoUrl: string | null
  onChange: (design: {
    fgColor: string
    bgColor: string
    moduleShape: ModuleShape
    frameType: string | null
    frameLabel: string
    logoUrl: string | null
  }) => void
}

export function DesignEditor({
  fgColor,
  bgColor,
  moduleShape,
  frameType,
  frameLabel,
  logoUrl,
  onChange,
}: DesignEditorProps) {
  function update(partial: Partial<Parameters<typeof onChange>[0]>) {
    onChange({
      fgColor,
      bgColor,
      moduleShape,
      frameType,
      frameLabel,
      logoUrl,
      ...partial,
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <ColorPicker
          label="Couleur des modules"
          value={fgColor}
          onChange={(c) => update({ fgColor: c })}
        />
        <ColorPicker
          label="Couleur de fond"
          value={bgColor}
          onChange={(c) => update({ bgColor: c })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Forme des modules</Label>
        <ShapeSelector
          value={moduleShape}
          onChange={(s) => update({ moduleShape: s })}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Logo</Label>
        <LogoUploader
          onUpload={(url) => update({ logoUrl: url })}
        />
        {logoUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo" className="size-8 rounded object-cover" />
            <button
              type="button"
              onClick={() => update({ logoUrl: null })}
              className="text-xs text-destructive hover:underline"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Cadre</Label>
        <FrameSelector
          value={frameType}
          onChange={(f) => update({ frameType: f })}
        />
      </div>

      {frameType && (
        <div className="space-y-2">
          <Label htmlFor="frame-label">Texte du cadre</Label>
          <Input
            id="frame-label"
            placeholder="Ex: Scannez-moi !"
            value={frameLabel}
            onChange={(e) => update({ frameLabel: e.target.value })}
            maxLength={50}
          />
        </div>
      )}
    </div>
  )
}
