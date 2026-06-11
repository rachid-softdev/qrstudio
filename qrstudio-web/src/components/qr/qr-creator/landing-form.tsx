"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorPicker } from "./color-picker"
import { LogoUploader } from "./logo-uploader"

const landingFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional().or(z.literal("")),
  ctaLabel: z.string().optional().or(z.literal("")),
  ctaUrl: z.string().url("URL invalide").optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  bgColor: z.string(),
  textColor: z.string(),
})

type LandingFormData = z.infer<typeof landingFormSchema>

interface LandingFormProps {
  onChange: (data: LandingFormData) => void
  defaultValues?: Partial<LandingFormData>
}

export function LandingForm({ onChange, defaultValues }: LandingFormProps) {
  const { register, watch, setValue, formState: { errors } } = useForm<LandingFormData>({
    resolver: zodResolver(landingFormSchema),
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
        <Label htmlFor="lp-title">Titre <span className="text-destructive">*</span></Label>
        <Input id="lp-title" placeholder="Titre de votre page" {...register("title", { onChange: handleChange })} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
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
