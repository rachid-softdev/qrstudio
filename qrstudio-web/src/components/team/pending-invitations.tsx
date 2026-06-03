"use client"

import { MailIcon, ClockIcon } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

interface PendingInvitation {
  id: string
  email: string
  role: string
  createdAt: Date
  expiresAt: Date
}

interface PendingInvitationsProps {
  invitations: PendingInvitation[]
  isOwner?: boolean
}

export function PendingInvitations({
  invitations,
  isOwner = false,
}: PendingInvitationsProps) {
  if (invitations.length === 0 && !isOwner) return null

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={MailIcon}
        title="Aucune invitation en attente"
        description="Invitez des collaborateurs à rejoindre votre espace de travail"
      />
    )
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case "EDITOR":
        return "Éditeur"
      case "VIEWER":
        return "Lecteur"
      default:
        return role
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MailIcon className="size-4" />
        Invitations en attente ({invitations.length})
      </h3>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Envoyée le</TableHead>
              <TableHead>Expire le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">
                  {invitation.email}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {getRoleLabel(invitation.role)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(new Date(invitation.createdAt))}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    {formatDate(new Date(invitation.expiresAt))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
