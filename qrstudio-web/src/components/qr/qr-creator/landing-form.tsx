"use client"

import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorPicker } from "./color-picker"
import { LogoUploader } from "./logo-uploader"

interface LandingFormData {
  title: string
  description?: string
  ctaLabel?: string
  ctaUrl?: string
  imageUrl?: string
  bgColor: string
  textColor: string
}

interface LandingFormProps {
  onChange: (data: LandingFormData) => void
  defaultValues?: Partial<LandingFormData>
}

export function LandingForm({ onChange, defaultValues }: LandingFormProps) {
  const { register, watch, setValue } = useForm<LandingFormData>({
    defaultValues: { bgColor: "#FFFFFF", textColor: "#111827", ...defaultValues },
  })

  const values = watch()

  function handleChange() {
    onChange(values)
  }

  function handleBgColorChange(color: string) {
    setValue("bgColor", color)
    onChange({ ...values, bgColor: color })
  }

  function handleTextColorChange(color: string) {
    setValue("textColor", color)
    onChange({ ...values, textColor: color })
  }

  function handleImageUpload(url: string) {
    setValue("imageUrl", url)
    onChange({ ...values, imageUrl: url })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lp-title">Titre</Label>
        <Input id="lp-title" placeholder="Titre de votre page" {...register("title", { onChange: handleChange })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lp-description">Description</Label>
        <textarea
          id="lp-description"
          className="h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          placeholder="Description de votre page"
          {...register("description", { onChange: handleChange })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cta-label">Texte du bouton</Label>
          <Input id="cta-label" placeholder="En savoir plus" {...register("ctaLabel", { onChange: handleChange })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cta-url">Lien du bouton</Label>
          <Input id="cta-url" type="url" placeholder="https://" {...register("ctaUrl", { onChange: handleChange })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image</Label>
        <LogoUploader onUpload={handleImageUpload} />
        {values.imageUrl && (
          <p className="text-xs text-muted-foreground truncate">{values.imageUrl}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ColorPicker label="Couleur de fond" value={values.bgColor} onChange={handleBgColorChange} />
        <ColorPicker label="Couleur du texte" value={values.textColor} onChange={handleTextColorChange} />
      </div>
    </div>
  )
}
