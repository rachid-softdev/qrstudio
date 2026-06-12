"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Loader2Icon, ArrowLeftIcon, MailCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const forgotSchema = z.object({
  email: z.string().email("Email invalide"),
})

type ForgotFormData = z.infer<typeof forgotSchema>

export function ForgotPasswordForm() {
  const router = useRouter()
  const [isSubmitted, setIsSubmitted] = useState(false)

  const requestReset = api.auth.requestPasswordReset.useMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  async function onSubmit(data: ForgotFormData) {
    try {
      await requestReset.mutateAsync({ email: data.email })
      setIsSubmitted(true)
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.")
    }
  }

  if (isSubmitted) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <MailCheckIcon className="size-6 text-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold">Email envoyé</h2>
        <p className="text-sm text-muted-foreground">
          Si un compte existe avec cette adresse email, vous recevrez un lien de
          réinitialisation sous quelques minutes.
        </p>
        <p className="text-xs text-muted-foreground">
          Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/login")}
        >
          <ArrowLeftIcon className="size-4" />
          Retour à la connexion
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Adresse email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="vous@exemple.com"
          autoComplete="email"
          autoFocus
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={requestReset.isPending}
      >
        {requestReset.isPending && (
          <Loader2Icon className="size-4 animate-spin" />
        )}
        {requestReset.isPending
          ? "Envoi en cours..."
          : "Envoyer le lien de réinitialisation"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="font-medium text-primary hover:underline"
        >
          <ArrowLeftIcon className="mr-1 inline size-3" />
          Retour à la connexion
        </button>
      </p>
    </form>
  )
}
