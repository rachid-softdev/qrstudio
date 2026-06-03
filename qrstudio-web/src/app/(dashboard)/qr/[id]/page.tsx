import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { analyticsService } from "@/server/services/analytics.service"
import { QRDetailClient } from "./qr-detail-client"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    return { title: "QR Code" }
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      ownerId: session.user.id,
    },
  })

  if (!workspace) {
    return { title: "QR Code" }
  }

  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId: workspace.id },
  })

  if (!qrCode) {
    return { title: "QR Code introuvable" }
  }

  return {
    title: `${qrCode.name} — QR Studio`,
    description: `QR code de type ${qrCode.type}`,
  }
}

export default async function QRDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      ownerId: session.user.id,
    },
  })

  if (!workspace) {
    redirect("/")
  }

  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { landingPage: true, scans: { take: 50, orderBy: { scannedAt: "desc" } } },
  })

  if (!qrCode) {
    notFound()
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId: session.user.id },
  })
  const role = workspace.ownerId === session.user.id ? "OWNER" : (member?.role ?? "VIEWER")

  let analyticsData: Awaited<ReturnType<typeof analyticsService.getAnalytics>> | null = null
  try {
    analyticsData = await analyticsService.getAnalytics(id, "30d")
  } catch {
    analyticsData = null
  }

  const plan = session.user.plan ?? "FREE"
  const retentionDays = plan === "FREE" ? 30 : plan === "PRO" ? 365 : Infinity

  return (
    <QRDetailClient
      qrCode={qrCode}
      workspaceId={workspace.id}
      role={role}
      analyticsInitialData={analyticsData}
      retentionDays={retentionDays}
    />
  )
}
