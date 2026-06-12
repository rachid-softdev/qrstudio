"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react"

const themes = [
  { value: "light", label: "Clair", icon: SunIcon },
  { value: "dark", label: "Sombre", icon: MoonIcon },
  { value: "system", label: "Système", icon: MonitorIcon },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-lg border p-0.5">
        {themes.map((t) => (
          <div
            key={t.value}
            className="flex size-7 items-center justify-center rounded-md"
          >
            <t.icon className="size-3.5 text-muted-foreground/50" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-0.5">
      {themes.map((t) => {
        const Icon = t.icon
        const isActive = theme === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={t.label}
            title={t.label}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
