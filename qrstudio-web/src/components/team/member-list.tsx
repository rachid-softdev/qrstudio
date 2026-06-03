"use client"

import { toast } from "sonner"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table"
import { api } from "@/lib/trpc/client"
import { EmptyState } from "@/components/shared/empty-state"
import { UsersIcon, UserPlusIcon } from "lucide-react"
import { MemberRow } from "./member-row"

interface Member {
  id: string
  userId: string
  role: string
  joinedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface MemberListProps {
  members: Member[]
  workspaceId: string
  currentUserId: string
  isOwner: boolean
}

export function MemberList({
  members,
  workspaceId,
  currentUserId,
  isOwner,
}: MemberListProps) {
  const utils = api.useUtils()

  const updateRoleMutation = api.team.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.team.listMembers.invalidate()
      toast.success("Rôle mis à jour")
    },
    onError: (err) => toast.error(err.message),
  })

  const removeMemberMutation = api.team.removeMember.useMutation({
    onSuccess: () => {
      utils.team.listMembers.invalidate()
      toast.success("Membre retiré de l'équipe")
    },
    onError: (err) => toast.error(err.message),
  })

  if (members.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Aucun membre"
        description="Invitez des collaborateurs à rejoindre votre espace de travail"
      />
    )
  }

  const showInviteCTA = members.length === 1 && isOwner

  return (
    <div className="space-y-4">
      {showInviteCTA && (
        <EmptyState
          icon={UserPlusIcon}
          title="Invitez des collaborateurs"
          description="Élargissez votre équipe pour travailler ensemble sur vos QR codes."
        />
      )}
      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Membre depuis</TableHead>
            {isOwner && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              isOwner={isOwner}
              onUpdateRole={(userId, role) =>
                updateRoleMutation.mutate({ workspaceId, userId, role })
              }
              onRemove={(userId) =>
                removeMemberMutation.mutate({ workspaceId, userId })
              }
              isUpdatingRole={updateRoleMutation.isPending}
              isRemoving={removeMemberMutation.isPending}
            />
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  )
}
