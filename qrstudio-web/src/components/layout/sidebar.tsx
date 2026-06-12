"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboardIcon,
  QrCodeIcon,
  UsersIcon,
  CreditCardIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon,
  MenuIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/dashboard/qr-codes", label: "QR Codes", icon: QrCodeIcon },
  { href: "/dashboard/team", label: "Équipe", icon: UsersIcon },
  { href: "/dashboard/billing", label: "Facturation", icon: CreditCardIcon },
  { href: "/dashboard/settings", label: "Paramètres", icon: SettingsIcon },
] as const

function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserMenu() {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user

  function handleLogout() {
    signOut({ callbackUrl: "/login" })
  }

  function handleGoToProfile() {
    router.push("/dashboard/settings")
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted">
        <Avatar size="sm">
          {user?.image ? (
            <AvatarImage src={user.image} alt={user.name ?? ""} />
          ) : (
            <AvatarFallback>{initials}</AvatarFallback>
          )}
        </Avatar>
        <div className="flex flex-1 flex-col items-start text-left">
          <span className="text-sm font-medium text-foreground">
            {user?.name ?? "Utilisateur"}
          </span>
          <span className="max-w-32 truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem onClick={handleGoToProfile}>
          <UserIcon className="size-4" />
          Profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOutIcon className="size-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PlanBadge() {
  const { data: session } = useSession()
  const plan = (session?.user as { plan?: string } | undefined)?.plan ?? "FREE"

  return (
    <Badge variant="outline" className="justify-center py-1">
      {plan === "FREE" ? "Gratuit" : plan === "PRO" ? "Pro" : "Agency"}
    </Badge>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard">
        <Logo size="sm" />
      </Link>

      <Separator />

      <NavLinks className="flex-1" />

      <Separator />

      <div className="flex justify-center">
        <ThemeToggle />
      </div>

      <Separator />

      <div className="space-y-3">
        <UserMenu />
        <PlanBadge />
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      {/* Mobile header bar */}
      <Sheet>
        <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b bg-background p-3 lg:hidden">
          <SheetTrigger>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <Logo size="sm" />
        </div>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <SidebarContent />
      </aside>
    </>
  )
}
