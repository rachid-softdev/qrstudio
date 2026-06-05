"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QR_TYPES } from "@/lib/constants"
import type { QRType, QRStatus } from "@/types"

interface QRListFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  type?: QRType | "all"
  onTypeChange: (value: QRType | "all") => void
  status?: QRStatus | "all"
  onStatusChange: (value: QRStatus | "all") => void
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

export function QRListFilters({
  search,
  onSearchChange,
  type = "all",
  onTypeChange,
  status = "all",
  onStatusChange,
}: QRListFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        aria-label="Rechercher un QR code"
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
      />
      <Select
        value={type}
        onValueChange={(value) => onTypeChange(value as QRType | "all")}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Tous les types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          {QR_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {typeLabels[t] ?? t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as QRStatus | "all")}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Tous les statuts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="ACTIVE">Actif</SelectItem>
          <SelectItem value="PAUSED">En pause</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
