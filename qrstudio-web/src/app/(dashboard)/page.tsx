import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { EmptyState } from "@/components/shared/empty-state"
import { QrCodeIcon, PlusIcon } from "lucide-react"
import { analyticsService } from "@/server/services/analytics.service"
import { Header } from "@/components/layout/header"
import { DashboardStatsClient } from "./dashboard-stats-client"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Dashboard — QR Studio",
  description: "Vue d'ensemble de votre espace QR Studio",
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  })

  if (!workspace) {
    redirect("/login")
  }

  const qrCodeCount = await prisma.qRCode.count({
    where: { workspaceId: workspace.id },
  })

  const userName = session.user.name ?? "Utilisateur"

  if (qrCodeCount === 0) {
    return (
      <div className="space-y-8">
        <Header
          title={`Bienvenue sur QR Studio, ${userName}`}
          description="Gérez vos QR codes dynamiques et suivez leurs performances."
        />
        <EmptyState
          icon={QrCodeIcon}
          title="Créez votre premier QR code"
          description="Commencez par créer un QR code dynamique pour votre contenu."
          action={{
            label: "Nouveau QR code",
            href: "/dashboard/qr/new",
          }}
        />
      </div>
    )
  }

  const stats = await analyticsService.getDashboardStats(workspace.id)

  return (
    <div className="space-y-8">
      <Header
        title={`Bienvenue sur QR Studio, ${userName}`}
        description="Gérez vos QR codes dynamiques et suivez leurs performances."
        actions={
          <Link href="/dashboard/qr/new">
            <Button variant="default" size="sm">
              <PlusIcon className="size-4" />
              Nouveau QR code
            </Button>
          </Link>
        }
      />

      <DashboardStatsClient initialData={stats} />
    </div>
  )
}
