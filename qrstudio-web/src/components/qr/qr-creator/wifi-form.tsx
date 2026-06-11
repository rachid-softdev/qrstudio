"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const wifiFormSchema = z.object({
  ssid: z.string().min(1, "Le nom du réseau est requis"),
  password: z.string().optional(),
  encryption: z.enum(["WPA", "WEP", "nopass"]),
})

type WifiFormData = z.infer<typeof wifiFormSchema>

interface WifiFormProps {
  onChange: (data: { ssid: string; password?: string; encryption: "WPA" | "WEP" | "nopass" }) => void
  defaultValues?: Partial<WifiFormData>
}

export function WifiForm({ onChange, defaultValues }: WifiFormProps) {
  const { register, watch, setValue, formState: { errors } } = useForm<WifiFormData>({
    resolver: zodResolver(wifiFormSchema),
    defaultValues: { encryption: "WPA", ...defaultValues },
  })

  const values = watch()

  function handleFieldChange() {
    const current = { ssid: values.ssid, password: values.password, encryption: values.encryption }
    onChange(current)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ssid">Nom du réseau (SSID) <span className="text-destructive">*</span></Label>
        <Input
          id="ssid"
          placeholder="Mon WiFi"
          {...register("ssid", { onChange: handleFieldChange })}
        />
        {errors.ssid && <p className="text-xs text-destructive">{errors.ssid.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          placeholder="Laissez vide si aucun"
          {...register("password", { onChange: handleFieldChange })}
        />
      </div>

      <div className="space-y-2">
        <Label>Chiffrement</Label>
        <Select
          value={values.encryption}
          onValueChange={(value) => {
            if (value) {
              setValue("encryption", value as "WPA" | "WEP" | "nopass")
              handleFieldChange()
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WPA">WPA/WPA2</SelectItem>
            <SelectItem value="WEP">WEP</SelectItem>
            <SelectItem value="nopass">Aucun</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
