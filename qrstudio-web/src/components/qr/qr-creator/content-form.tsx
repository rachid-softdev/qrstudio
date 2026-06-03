"use client"

import type { QRType } from "@/types/index"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WifiForm } from "./wifi-form"
import { VCardForm } from "./vcard-form"
import { LandingForm } from "./landing-form"
import { PdfUploader } from "./pdf-uploader"

interface ContentFormProps {
  type: QRType
  onChange: (data: Record<string, unknown>) => void
  values: Record<string, unknown>
}

export function ContentForm({ type, onChange, values }: ContentFormProps) {
  switch (type) {
    case "URL":
      return (
        <div className="space-y-2">
          <Label htmlFor="url">URL de destination</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://exemple.fr"
            value={(values.destinationUrl as string) ?? ""}
            onChange={(e) => onChange({ destinationUrl: e.target.value })}
          />
        </div>
      )

    case "WHATSAPP":
      return (
        <div className="space-y-2">
          <Label htmlFor="whatsapp">Numéro de téléphone</Label>
          <Input
            id="whatsapp"
            type="tel"
            placeholder="+33612345678"
            value={(values.destinationUrl as string) ?? ""}
            onChange={(e) => onChange({ destinationUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Le QR code ouvrira WhatsApp avec ce numéro pré-rempli.
          </p>
        </div>
      )

    case "WIFI":
      return <WifiForm onChange={(data) => onChange({ wifi: data })} defaultValues={values.wifi as Record<string, string> | undefined} />

    case "VCARD":
      return <VCardForm onChange={(data) => onChange({ vcard: data })} defaultValues={values.vcard as Record<string, string> | undefined} />

    case "PDF":
      return (
        <div className="space-y-2">
          <Label>Fichier PDF</Label>
          <PdfUploader
            onUpload={(url) => onChange({ destinationUrl: url })}
            value={values.destinationUrl as string | undefined}
          />
        </div>
      )

    case "TEXT":
      return (
        <div className="space-y-2">
          <Label htmlFor="text">Texte à afficher</Label>
          <textarea
            id="text"
            className="h-32 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            placeholder="Votre texte ici..."
            value={(values.textContent as string) ?? ""}
            onChange={(e) => onChange({ textContent: e.target.value })}
          />
        </div>
      )

    case "LANDING_PAGE":
      return (
        <LandingForm
          onChange={(data) => onChange({ landingPage: data })}
          defaultValues={values.landingPage as Record<string, string> | undefined}
        />
      )

    default:
      return null
  }
}
