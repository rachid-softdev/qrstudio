"use client"

import { toast } from "sonner"
import { UploadButton } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

interface LogoUploaderProps {
  onUpload: (url: string) => void
}

export function LogoUploader({ onUpload }: LogoUploaderProps) {
  return (
    <UploadButton<OurFileRouter, "logoImageUploader">
      endpoint="logoImageUploader"
      onClientUploadComplete={(res) => {
        if (res?.[0]?.url) onUpload(res[0].url)
      }}
      onUploadError={(err) => {
        toast.error("Échec de l'upload du logo")
      }}
      content={{
        button({ ready, isUploading }) {
          if (isUploading) return "Upload en cours..."
          if (!ready) return "Chargement..."
          return "Choisir un fichier"
        },
      }}
      appearance={{
        button: "inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent ut-uploading:opacity-50 ut-uploading:cursor-not-allowed",
      }}
    />
  )
}
