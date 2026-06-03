"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Loader2Icon } from "lucide-react"
import { formatDate } from "@/lib/utils"

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

interface MemberRowProps {
  member: Member
  workspaceId: string
  currentUserId: string
  isOwner: boolean
  onUpdateRole: (userId: string, role: "EDITOR" | "VIEWER") => void
  onRemove: (userId: string) => void
  isUpdatingRole: boolean
  isRemoving: boolean
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function isSelf(userId: string, currentUserId: string) {
  return userId === currentUserId
}

export function MemberRow({
  member,
  workspaceId,
  currentUserId,
  isOwner,
  onUpdateRole,
  onRemove,
  isUpdatingRole,
  isRemoving,
}: MemberRowProps) {
  return (
    <TableRow key={member.id}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {member.user.image ? (
              <AvatarImage
                src={member.user.image}
                alt={member.user.name ?? ""}
              />
            ) : (
              <AvatarFallback>
                {getInitials(member.user.name)}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="text-sm font-medium">
              {member.user.name ?? "Utilisateur"}
              {isSelf(member.userId, currentUserId) && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (vous)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {member.user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {isOwner && member.role !== "OWNER" ? (
          <Select
            defaultValue={member.role}
            onValueChange={(role) => {
              if (role !== "EDITOR" && role !== "VIEWER") return
              onUpdateRole(member.userId, role)
            }}
            disabled={isUpdatingRole}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDITOR">Éditeur</SelectItem>
              <SelectItem value="VIEWER">Lecteur</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">
            {member.role === "OWNER"
              ? "Propriétaire"
              : member.role === "EDITOR"
                ? "Éditeur"
                : "Lecteur"}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(new Date(member.joinedAt))}
      </TableCell>
      {isOwner && (
        <TableCell className="text-right">
          {member.role !== "OWNER" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onRemove(member.userId)}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "Retirer"
              )}
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}
