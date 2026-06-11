"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const vcardFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  website: z.string().url("URL invalide").optional().or(z.literal("")),
})

type VCardFormData = z.infer<typeof vcardFormSchema>

interface VCardFormProps {
  onChange: (data: VCardFormData) => void
  defaultValues?: Partial<VCardFormData>
}

export function VCardForm({ onChange, defaultValues }: VCardFormProps) {
  const { register, watch, formState: { errors } } = useForm<VCardFormData>({
    resolver: zodResolver(vcardFormSchema),
    defaultValues,
  })

  const values = watch()

  function handleChange() {
    onChange(values)
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">Prénom <span className="text-destructive">*</span></Label>
        <Input id="firstName" placeholder="Jean" {...register("firstName", { onChange: handleChange })} />
        {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Nom <span className="text-destructive">*</span></Label>
        <Input id="lastName" placeholder="Dupont" {...register("lastName", { onChange: handleChange })} />
        {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="vcard-email">Email</Label>
        <Input id="vcard-email" type="email" placeholder="jean@exemple.fr" {...register("email", { onChange: handleChange })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" placeholder="+33612345678" {...register("phone", { onChange: handleChange })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Entreprise</Label>
        <Input id="company" placeholder="Acme Inc" {...register("company", { onChange: handleChange })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Site web</Label>
        <Input id="website" type="url" placeholder="https://exemple.fr" {...register("website", { onChange: handleChange })} />
      </div>
    </div>
  )
}
