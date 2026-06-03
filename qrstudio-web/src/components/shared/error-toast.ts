import { toast } from "sonner"
import { TRPCClientError } from "@trpc/client"

/**
 * Affiche un toast d'erreur lisible pour l'utilisateur.
 * Transforme les erreurs tRPC en messages explicites.
 */
export function showErrorToast(error: unknown, fallback = "Une erreur est survenue") {
  if (error instanceof TRPCClientError) {
    const message = error.data?.zodError
      ? "Données invalides. Vérifiez les champs du formulaire."
      : error.message || fallback
    toast.error(message)
  } else if (error instanceof Error) {
    toast.error(error.message || fallback)
  } else {
    toast.error(fallback)
  }
}
