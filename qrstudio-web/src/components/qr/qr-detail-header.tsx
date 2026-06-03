"use client"

import Link from "next/link"
import { PauseIcon, PlayIcon, Trash2Icon, EditIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { formatDate } from "@/lib/utils"
import type { QRType, QRStatus } from "@/types/index"

type Role = "OWNER" | "EDITOR" | "VIEWER"

const typeLabels: Record<string, string> = {
  URL: "URL",
  WHATSAPP: "WhatsApp",
  WIFI: "Wi-Fi",
  VCARD: "vCard",
  PDF: "PDF",
  TEXT: "Texte",
  LANDING_PAGE: "Landing Page",
}

interface QRDetailHeaderProps {
  id: string
  name: string
  type: QRType
  status: QRStatus
  createdAt: Date
  role: Role
  onToggleStatus: () => void
  onDelete: () => void
  isToggling: boolean
  isDeleting: boolean
}

export function QRDetailHeader({
  id,
  name,
  type,
  status,
  createdAt,
  role,
  onToggleStatus,
  onDelete,
  isToggling,
  isDeleting,
}: QRDetailHeaderProps) {
  const canEdit = role === "OWNER" || role === "EDITOR"
  const isOwner = role === "OWNER"

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex-1">
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          Créé le {formatDate(new Date(createdAt))}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{typeLabels[type] ?? type}</Badge>
        <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
          {status === "ACTIVE" ? "Actif" : "En pause"}
        </Badge>
      </div>
      {canEdit && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link href={`/qr/${id}/edit`}>
            <Button variant="outline" size="sm">
              <EditIcon className="size-4" />
              Éditer destination
            </Button>
          </Link>
          <Button
            variant={status === "ACTIVE" ? "secondary" : "default"}
            size="sm"
            onClick={onToggleStatus}
            disabled={isToggling}
          >
            {status === "ACTIVE" ? (
              <><PauseIcon className="size-4" /> Mettre en pause</>
            ) : (
              <><PlayIcon className="size-4" /> Activer</>
            )}
          </Button>
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  <Trash2Icon className="size-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Supprimer ce QR code ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Les scans déjà collectés seront
                  également supprimés.
                </AlertDialogDescription>
                <div className="flex justify-end gap-2">
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>
                    Supprimer
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  )
}
