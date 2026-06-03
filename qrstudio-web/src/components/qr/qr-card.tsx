"use client"

import Link from "next/link"
import { MoreHorizontalIcon, QrCodeIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { formatDate, formatNumber } from "@/lib/utils"
import type { QRType, QRStatus } from "@prisma/client"

interface QRCardProps {
  id: string
  name: string
  shortCode: string
  type: QRType
  status: QRStatus
  totalScans: number
  createdAt: Date
  role?: "OWNER" | "EDITOR" | "VIEWER"
  onDelete?: (id: string) => void
  onToggleStatus?: (id: string, status: QRStatus) => void
}

const typeLabels: Record<string, string> = {
  URL: "URL",
  WHATSAPP: "WhatsApp",
  WIFI: "Wi-Fi",
  VCARD: "vCard",
  PDF: "PDF",
  TEXT: "Texte",
  LANDING_PAGE: "Landing Page",
}

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
}

export function QRCard({
  id,
  name,
  shortCode,
  type,
  status,
  totalScans,
  createdAt,
  role,
  onDelete,
  onToggleStatus,
}: QRCardProps) {
  const canEdit = role === "OWNER" || role === "EDITOR"
  return (
    <Link href={`/dashboard/qr/${id}`}>
      <Card size="sm" className="group cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <QrCodeIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>{name}</CardTitle>
                <CardDescription>
                  /{shortCode}
                </CardDescription>
              </div>
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Plus d'options"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onToggleStatus?.(id, status === "ACTIVE" ? "PAUSED" : "ACTIVE")
                    }}
                  >
                    {status === "ACTIVE" ? "Mettre en pause" : "Activer"}
                  </DropdownMenuItem>
                  {role === "OWNER" && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        onDelete?.(id)
                      }}
                    >
                      Supprimer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {typeLabels[type] ?? type}
            </Badge>
            <Badge variant={statusVariants[status] ?? "outline"} className="text-xs">
              {status === "ACTIVE" ? "Actif" : "En pause"}
            </Badge>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span>{formatNumber(totalScans)} scan{totalScans !== 1 ? "s" : ""}</span>
            <span>Créé le {formatDate(new Date(createdAt))}</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
