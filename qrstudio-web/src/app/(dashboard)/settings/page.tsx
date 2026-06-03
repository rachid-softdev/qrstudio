import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { Header } from "@/components/layout/header"
import { ProfileForm } from "@/components/settings/profile-form"
import { SecurityForm } from "@/components/settings/security-form"
import { ApiKeyManager } from "@/components/settings/api-key-manager"
import { DangerZone } from "@/components/settings/danger-zone"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Paramètres — QR Studio",
  description: "Gérez vos paramètres de compte",
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
    },
  })

  if (!user) {
    redirect("/login")
  }

  const hasApiAccess = user.plan !== "FREE"

  return (
    <div className="space-y-8">
      <Header
        title="Paramètres"
        description="Gérez votre compte et vos préférences"
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profil</h2>
          <p className="text-sm text-muted-foreground">
            Modifiez votre nom et votre photo de profil
          </p>
        </div>
        <ProfileForm
          defaultName={user.name ?? ""}
          defaultImage={user.image ?? ""}
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sécurité</h2>
          <p className="text-sm text-muted-foreground">
            Changez votre mot de passe
          </p>
        </div>
        <SecurityForm />
      </section>

      {hasApiAccess && (
        <>
          <Separator />
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Clés API</h2>
              <p className="text-sm text-muted-foreground">
                Gérez vos clés d&apos;accès à l&apos;API
              </p>
            </div>
            <ApiKeyManager />
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-destructive">
            Zone de danger
          </h2>
          <p className="text-sm text-muted-foreground">
            Actions irréversibles sur votre compte
          </p>
        </div>
        <DangerZone />
      </section>
    </div>
  )
}
