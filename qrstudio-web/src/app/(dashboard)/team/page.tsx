import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { Header } from "@/components/layout/header"
import { MemberList } from "@/components/team/member-list"
import { InviteForm } from "@/components/team/invite-form"
import { PendingInvitations } from "@/components/team/pending-invitations"

export const metadata: Metadata = {
  title: "Équipe — QR Studio",
  description: "Gérez les membres de votre espace de travail",
}

export default async function TeamPage() {
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

  const currentMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: session.user.id,
      },
    },
  })

  const isOwner = currentMember?.role === "OWNER"

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: "asc" },
  })

  const invitations = await prisma.workspaceInvitation.findMany({
    where: {
      workspaceId: workspace.id,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-8">
      <Header
        title="Équipe"
        description="Gérez les membres de votre espace de travail"
      />

      {isOwner && <InviteForm workspaceId={workspace.id} />}

      <MemberList
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        }))}
        workspaceId={workspace.id}
        currentUserId={session.user.id}
        isOwner={isOwner}
      />

      <PendingInvitations
        invitations={invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
        }))}
        isOwner={isOwner}
      />
    </div>
  )
}
