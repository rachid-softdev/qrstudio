"use client"

import { FileTextIcon } from "lucide-react"
import { UploadButton } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"
import { cn } from "@/lib/utils"

interface PdfUploaderProps {
  onUpload: (url: string) => void
  value?: string
}

export function PdfUploader({ onUpload, value }: PdfUploaderProps) {
  return (
    <div className="space-y-2">
      <UploadButton<OurFileRouter, "pdfUploader">
        endpoint="pdfUploader"
        onClientUploadComplete={(res) => {
          if (res?.[0]?.url) onUpload(res[0].url)
        }}
        onUploadError={() => {}}
        content={{
          button({ ready, isUploading }) {
            if (isUploading) return "Upload en cours..."
            if (!ready) return "Chargement..."
            return value ? "Changer le PDF" : "Uploader un PDF"
          },
        }}
        appearance={{
          button: "inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent ut-uploading:opacity-50 ut-uploading:cursor-not-allowed",
        }}
      />
      {value && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border p-2 text-sm",
          "border-border"
        )}>
          <FileTextIcon className="size-4 text-muted-foreground" />
          <span className="truncate text-muted-foreground">PDF uploadé</span>
        </div>
      )}
    </div>
  )
}
