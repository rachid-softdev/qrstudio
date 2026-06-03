"use client"

import type { QRType } from "@/types/index"
import {
  GlobeIcon,
  MessageSquareTextIcon,
  WifiIcon,
  Contact2Icon,
  FileTextIcon,
  TypeIcon,
  LayoutIcon,
} from "lucide-react"
import { TypeCard } from "./type-card"

interface TypeSelectorProps {
  selected: QRType | null
  onSelect: (type: QRType) => void
}

const types: { type: QRType; icon: typeof GlobeIcon; title: string; description: string }[] = [
  { type: "URL", icon: GlobeIcon, title: "URL", description: "Redirige vers une page web" },
  { type: "WHATSAPP", icon: MessageSquareTextIcon, title: "WhatsApp", description: "Ouvre une conversation WhatsApp" },
  { type: "WIFI", icon: WifiIcon, title: "Wi-Fi", description: "Partage les identifiants Wi-Fi" },
  { type: "VCARD", icon: Contact2Icon, title: "vCard", description: "Partage une carte de visite" },
  { type: "PDF", icon: FileTextIcon, title: "PDF", description: "Lien vers un fichier PDF" },
  { type: "TEXT", icon: TypeIcon, title: "Texte", description: "Affiche du texte simple" },
  { type: "LANDING_PAGE", icon: LayoutIcon, title: "Landing Page", description: "Crée une page de destination" },
]

export function TypeSelector({ selected, onSelect }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {types.map(({ type, icon, title, description }) => (
        <TypeCard
          key={type}
          icon={icon}
          title={title}
          description={description}
          selected={selected === type}
          onClick={() => onSelect(type)}
        />
      ))}
    </div>
  )
}
