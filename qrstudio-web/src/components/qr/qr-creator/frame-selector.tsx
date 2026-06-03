"use client"

import { cn } from "@/lib/utils"

interface FrameSelectorProps {
  value: string | null
  onChange: (frame: string | null) => void
}

const frames = [
  { value: null, label: "Aucune" },
  { value: "minimal", label: "Minimal" },
  { value: "rounded", label: "Arrondi" },
  { value: "dashed", label: "Tireté" },
  { value: "bold", label: "Gras" },
  { value: "neon", label: "Néon" },
  { value: "elegant", label: "Élégant" },
]

export function FrameSelector({ value, onChange }: FrameSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {frames.map((frame) => (
        <button
          key={frame.label}
          type="button"
          onClick={() => onChange(frame.value)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-all hover:bg-muted/50",
            value === frame.value
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border"
          )}
        >
          <svg viewBox="0 0 40 40" className="size-8">
            {frame.value ? (
              <rect
                x="2" y="2" width="36" height="36"
                rx={frame.value === "rounded" ? "8" : frame.value === "elegant" ? "2" : "2"}
                fill="none"
                stroke="currentColor"
                strokeWidth={frame.value === "bold" ? "4" : "1"}
                strokeDasharray={frame.value === "dashed" ? "4,3" : "none"}
                className="text-muted-foreground"
              />
            ) : (
              <>
                <rect x="2" y="2" width="36" height="36" rx="2" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
                <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
                <line x1="20" y1="10" x2="20" y2="30" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/50" />
              </>
            )}
          </svg>
          <span className="text-[10px]">{frame.label}</span>
        </button>
      ))}
    </div>
  )
}
