"use client"

import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
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

export function CancelSubscription() {
  const [open, setOpen] = useState(false)
  const utils = api.useUtils()

  const cancelMutation = api.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Abonnement annulé. Vous conservez l'accès jusqu'à la fin de la période.")
      utils.billing.getSubscription.invalidate()
      setOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  function handleCancel() {
    cancelMutation.mutate()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>
        <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
          Résilier l&apos;abonnement
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Résilier l&apos;abonnement ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vous conserverez l&apos;accès aux fonctionnalités payantes jusqu&apos;à
            la fin de la période en cours. Aucun remboursement ne sera effectué
            pour la période entamée. Vos QR codes resteront actifs même après
            le retour au plan Gratuit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {cancelMutation.isPending
              ? "Résiliation en cours..."
              : "Confirmer la résiliation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
