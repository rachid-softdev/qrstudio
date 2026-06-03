"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2Icon, MailIcon } from "lucide-react"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const inviteSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["EDITOR", "VIEWER"]),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteFormProps {
  workspaceId: string
}

export function InviteForm({ workspaceId }: InviteFormProps) {
  const [selectedRole, setSelectedRole] = useState("EDITOR")
  const utils = api.useUtils()

  const inviteMutation = api.team.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation envoyée !")
      utils.team.listInvitations.invalidate()
      reset()
    },
    onError: (err) => toast.error(err.message),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "EDITOR" },
  })

  function onSubmit(data: InviteFormData) {
    inviteMutation.mutate({ ...data, workspaceId })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inviter un membre</CardTitle>
        <CardDescription>
          Envoyez une invitation par email à un nouveau collaborateur
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1">
            <Input
              type="email"
              placeholder="email@exemple.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          <input type="hidden" {...register("role")} value={selectedRole} />
          <Select
            defaultValue="EDITOR"
            onValueChange={(val) => {
              if (val) setSelectedRole(val)
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDITOR">Éditeur</SelectItem>
              <SelectItem value="VIEWER">Lecteur</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <MailIcon className="size-4" />
            )}
            Inviter
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
