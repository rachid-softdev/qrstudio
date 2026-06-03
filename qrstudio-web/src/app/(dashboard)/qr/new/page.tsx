import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { QRCreator } from "@/components/qr/qr-creator"
import { Header } from "@/components/layout/header"

export const metadata: Metadata = {
  title: "Nouveau QR code — QR Studio",
  description: "Créez un QR code dynamique",
}

export default async function QRNewPage() {
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

  return (
    <div className="space-y-8">
      <Header
        title="Nouveau QR code"
        description="Configurez votre QR code étape par étape."
      />
      <QRCreator workspaceId={workspace.id} />
    </div>
  )
}
