"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"
import { useSession } from "next-auth/react"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { UploadButton } from "@/lib/uploadthing"
import { cn } from "@/lib/utils"

const profileSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileFormProps {
  defaultName: string
  defaultImage: string
}

export function ProfileForm({
  defaultName,
  defaultImage,
}: ProfileFormProps) {
  const { update: updateSession } = useSession()
  const [imageUrl, setImageUrl] = useState(defaultImage)

  const updateMutation = api.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profil mis à jour")
      updateSession()
    },
    onError: (err) => toast.error(err.message),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: defaultName },
  })

  function onSubmit(data: ProfileFormData) {
    updateMutation.mutate({ name: data.name, image: imageUrl || undefined })
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar size="lg">
                {imageUrl ? (
                  <AvatarImage src={imageUrl} alt="Photo de profil" />
                ) : (
                  <AvatarFallback className="text-lg">
                    {getInitials(defaultName || "U")}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute -bottom-1 -right-1">
                <UploadButton
                  endpoint="logoImageUploader"
                  onClientUploadComplete={(res) => {
                    if (res?.[0]?.url) {
                      setImageUrl(res[0].url)
                    }
                  }}
                  onUploadError={(err: Error) => {
                    toast.error(err.message)
                  }}
                  className={cn(
                    "ut-button:size-7 ut-button:rounded-full ut-button:bg-primary ut-button:text-primary-foreground ut-button:shadow-sm ut-button:p-0",
                    "ut-allowed-content:hidden"
                  )}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">{defaultName || "Utilisateur"}</p>
              <p className="text-xs text-muted-foreground">
                Cliquez sur l&apos;icône pour changer votre photo
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nom
            </label>
            <Input
              id="name"
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2Icon className="size-4 animate-spin" />
            )}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
