import { Suspense } from "react"
import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { EmptyState } from "@/components/shared/empty-state"
import {
  QrCodeIcon,
  PlusIcon,
  GlobeIcon,
  MessageCircleIcon,
  WifiIcon,
  FileTextIcon,
  HelpCircleIcon,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { DashboardStats } from "./dashboard-stats"
import { Skeleton } from "@/components/shared/loading-skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    const useCases = [
      { icon: GlobeIcon, label: "Rediriger vers un site web", desc: "Modifiez la destination sans réimprimer" },
      { icon: MessageCircleIcon, label: "Lancer une conversation WhatsApp", desc: "Message pré-rempli en un scan" },
      { icon: WifiIcon, label: "Partager un réseau Wi-Fi", desc: "Connexion instantanée sans mot de passe" },
      { icon: FileTextIcon, label: "Distribuer un PDF", desc: "Document toujours à jour, même après impression" },
    ]

    return (
      <div className="space-y-8">
        <Header
          title={`Bienvenue sur QR Studio, ${userName}`}
          description="Créez, gérez et analysez vos QR codes dynamiques. Des codes qui fonctionnent même après impression."
        />

        <EmptyState
          icon={QrCodeIcon}
          title="Créez votre premier QR code"
          description="Un QR code dynamique se modifie à tout moment, même après impression. Commencez par choisir un type de contenu."
          action={{
            label: "Nouveau QR code",
            href: "/dashboard/qr/new",
          }}
        />

        <div>
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Exemples d&apos;utilisation
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {useCases.map((item) => (
              <Card key={item.label}>
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <HelpCircleIcon className="size-3.5" />
          <span>
            Consultez la page{" "}
            <Link href="/dashboard/aide" className="font-medium text-primary underline-offset-2 hover:underline">
              Aide
            </Link>{" "}
            pour en savoir plus sur les QR codes dynamiques.
          </span>
        </div>
      </div>
    )
  }

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

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="size-4" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        }
      >
        <DashboardStats workspaceId={workspace.id} />
      </Suspense>
    </div>
  )
}
