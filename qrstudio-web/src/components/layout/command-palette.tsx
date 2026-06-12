"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboardIcon,
  QrCodeIcon,
  UsersIcon,
  CreditCardIcon,
  SettingsIcon,
  HelpCircleIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Command {
  id: string
  label: string
  description?: string
  shortcut?: string
  icon: React.ElementType
  action: () => void
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = [
    {
      id: "create",
      label: "Créer un QR code",
      description: "Lancer l'assistant de création",
      shortcut: "c",
      icon: PlusIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/qr/new")
      },
    },
    { id: "sep1", label: "", description: "", icon: PlusIcon, action: () => {} },
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Vue d'ensemble",
      shortcut: "g d",
      icon: LayoutDashboardIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard")
      },
    },
    {
      id: "qr-codes",
      label: "QR Codes",
      description: "Liste de vos QR codes",
      shortcut: "g q",
      icon: QrCodeIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/qr-codes")
      },
    },
    {
      id: "team",
      label: "Équipe",
      description: "Gérer les membres",
      shortcut: "g t",
      icon: UsersIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/team")
      },
    },
    {
      id: "billing",
      label: "Facturation",
      description: "Abonnement et utilisation",
      shortcut: "g b",
      icon: CreditCardIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/billing")
      },
    },
    {
      id: "settings",
      label: "Paramètres",
      description: "Profil et configuration",
      shortcut: "g s",
      icon: SettingsIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/settings")
      },
    },
    {
      id: "help",
      label: "Aide",
      description: "Documentation et FAQ",
      shortcut: "g h",
      icon: HelpCircleIcon,
      action: () => {
        setOpen(false)
        router.push("/dashboard/aide")
      },
    },
  ]

  const filtered = query
    ? commands.filter(
        (cmd) =>
          cmd.id !== "sep1" &&
          (cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : commands.filter((cmd) => cmd.id !== "sep1")

  // Keyboard shortcut to open palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // g then d/q/t/b/s/h navigation shortcuts
      if (!open && e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const handler = (e2: KeyboardEvent) => {
          const navMap: Record<string, string> = {
            d: "/dashboard",
            q: "/dashboard/qr-codes",
            t: "/dashboard/team",
            b: "/dashboard/billing",
            s: "/dashboard/settings",
            h: "/dashboard/aide",
          }
          const path = navMap[e2.key]
          if (path) {
            e2.preventDefault()
            router.push(path)
          }
        }
        window.addEventListener("keydown", handler, { once: true })
        setTimeout(() => window.removeEventListener("keydown", handler), 1000)
        return
      }

      // "c" shortcut to create QR (not in input fields)
      if (
        !open &&
        e.key === "c" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        router.push("/dashboard/qr/new")
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, router])

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      // Small delay for dialog animation
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    if (!open) {
      setQuery("")
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = query ? filtered : commands.filter((cmd) => cmd.id !== "sep1")

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % items.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case "Enter":
          e.preventDefault()
          if (items[selectedIndex]) {
            items[selectedIndex].action()
          }
          break
        case "Escape":
          setOpen(false)
          break
      }
    },
    [query, filtered, selectedIndex, commands, setOpen]
  )

  const displayItems = query ? filtered : commands.filter((cmd) => cmd.id !== "sep1")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay
        className="bg-black/20 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />
      <DialogContent
        showCloseButton={false}
        className="top-[15%] max-w-lg -translate-y-0 p-0 sm:max-w-lg"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Chercher une action ou une page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Rechercher dans les commandes"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls="command-list"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {displayItems.length > 0 ? (
          <div
            id="command-list"
            ref={listRef}
            className="max-h-[280px] overflow-y-auto p-1"
            role="listbox"
            aria-label="Commandes disponibles"
          >
            {displayItems.map((cmd, index) => (
              <button
                key={cmd.id}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <cmd.icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{cmd.label}</p>
                  {cmd.description && (
                    <p className="text-xs text-muted-foreground">
                      {cmd.description}
                    </p>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            Aucun résultat pour « {query} »
          </div>
        )}

        <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">↑↓</kbd>{" "}
            Naviguer
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">↵</kbd>{" "}
            Ouvrir
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">Esc</kbd>{" "}
            Fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
