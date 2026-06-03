import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { teamService } from "@/server/services/team.service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UserIcon, BuildingIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Invitation — QR Studio",
}

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const session = await auth()

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token },
    include: {
      workspace: {
        select: { name: true, owner: { select: { name: true } } },
      },
    },
  })

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation introuvable</CardTitle>
            <CardDescription>
              Cette invitation n&apos;existe pas ou a été supprimée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Retour à l&apos;accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation expirée</CardTitle>
            <CardDescription>
              Cette invitation a expiré. Contactez le propriétaire de l&apos;espace
              de travail pour une nouvelle invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Retour à l&apos;accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation déjà acceptée</CardTitle>
            <CardDescription>
              Cette invitation a déjà été utilisée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Se connecter</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (session?.user) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: session.user.id,
        },
      },
    })

    if (existingMember) {
      redirect("/dashboard")
    }

    await teamService.acceptInvitation(token, session.user.id)
    redirect("/dashboard")
  }

  const invitedByName = invitation.workspace.owner.name ?? "Un membre"

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <BuildingIcon className="size-8 text-primary" />
          </div>
          <CardTitle className="text-xl">
            Invitation à rejoindre {invitation.workspace.name}
          </CardTitle>
          <CardDescription>
            Vous avez été invité à collaborer sur cet espace de travail
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <UserIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Invité par</p>
              <p className="text-sm text-muted-foreground">{invitedByName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <BuildingIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Espace de travail</p>
              <p className="text-sm text-muted-foreground">
                {invitation.workspace.name}
              </p>
            </div>
          </div>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            Connectez-vous ou créez un compte pour accepter l&apos;invitation.
          </div>

          <div className="flex flex-col gap-2">
            <Link href={`/login?inviteToken=${token}`}>
              <Button className="w-full">Se connecter</Button>
            </Link>
            <Link href={`/register?inviteToken=${token}`}>
              <Button variant="outline" className="w-full">
                Créer un compte
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
