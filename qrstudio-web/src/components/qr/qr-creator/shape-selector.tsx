"use client"

import type { ModuleShape } from "@/lib/qr-generator"
import { cn } from "@/lib/utils"

interface ShapeSelectorProps {
  value: ModuleShape
  onChange: (shape: ModuleShape) => void
}

const shapes: { value: ModuleShape; label: string; icon: string }[] = [
  { value: "square", label: "Carrés", icon: "█" },
  { value: "rounded", label: "Arrondis", icon: "▣" },
  { value: "dots", label: "Points", icon: "●" },
]

export function ShapeSelector({ value, onChange }: ShapeSelectorProps) {
  return (
    <div className="flex gap-2">
      {shapes.map((shape) => (
        <button
          key={shape.value}
          type="button"
          onClick={() => onChange(shape.value)}
          className={cn(
            "flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all hover:bg-muted/50",
            value === shape.value
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border"
          )}
        >
          <span className="text-xl">{shape.icon}</span>
          <span className="text-xs font-medium">{shape.label}</span>
        </button>
      ))}
    </div>
  )
}
