"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface TypeCardProps {
  icon: LucideIcon
  title: string
  description: string
  selected: boolean
  onClick: () => void
}

export function TypeCard({ icon: Icon, title, description, selected, onClick }: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-all hover:bg-muted/50",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border"
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
