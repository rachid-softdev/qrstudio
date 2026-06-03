import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "QR Codes — QR Studio",
  description: "Gérez vos QR codes dynamiques",
}

export default async function QRCodesListPage() {
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
        title="QR Codes"
        description="Gérez vos QR codes dynamiques."
        actions={
          <Link href="/dashboard/qr/new">
            <Button variant="default" size="sm">
              <PlusIcon className="size-4" />
              Nouveau QR code
            </Button>
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">
        Utilisez le bouton ci-dessus pour créer un nouveau QR code.
      </p>
    </div>
  )
}
