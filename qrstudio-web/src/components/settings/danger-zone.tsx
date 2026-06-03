"use client"

import { useState } from "react"
import { toast } from "sonner"
import { signOut } from "next-auth/react"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"

export function DangerZone() {
  const [confirmText, setConfirmText] = useState("")
  const [open, setOpen] = useState(false)

  const deleteMutation = api.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Compte supprimé")
      signOut({ callbackUrl: "/login" })
    },
    onError: (err) => toast.error(err.message),
  })

  function handleDelete() {
    deleteMutation.mutate()
  }

  return (
    <Card className="border-destructive/50">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supprimer votre compte entraîne la suppression définitive de toutes
            les données associées, y compris vos QR codes et scans. Cette action
            est irréversible.
          </p>

          <AlertDialog
            open={open}
            onOpenChange={(newOpen) => {
              setOpen(newOpen)
              if (!newOpen) setConfirmText("")
            }}
          >
            <AlertDialogTrigger>
              <Button variant="destructive">
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Êtes-vous absolument sûr ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Toutes vos données seront
                  définitivement supprimées.
                  <br />
                  <br />
                  Tapez{" "}
                  <strong>supprimer</strong> pour confirmer.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <Input
                placeholder='Tapez "supprimer" pour confirmer'
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />

              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={
                    confirmText !== "supprimer" || deleteMutation.isPending
                  }
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleteMutation.isPending
                    ? "Suppression..."
                    : "Supprimer définitivement"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
