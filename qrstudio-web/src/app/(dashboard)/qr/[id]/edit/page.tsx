import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { QREditor } from "@/components/qr/qr-editor"
import { Header } from "@/components/layout/header"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    return { title: "Modifier le QR code" }
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  })

  if (!workspace) {
    return { title: "Modifier le QR code" }
  }

  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId: workspace.id },
  })

  if (!qrCode) {
    return { title: "QR code introuvable" }
  }

  return {
    title: `Modifier — ${qrCode.name} — QR Studio`,
  }
}

export default async function QREditPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  })

  if (!workspace) {
    redirect("/")
  }

  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId: workspace.id },
  })

  if (!qrCode) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Header
        title={`Modifier — ${qrCode.name}`}
        description="Modifiez la destination ou le design de votre QR code"
      />
      <QREditor qrCode={qrCode} />
    </div>
  )
}
