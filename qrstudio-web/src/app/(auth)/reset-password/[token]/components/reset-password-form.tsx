"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Loader2Icon, EyeIcon, EyeOffIcon, CheckCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    confirmPassword: z.string().min(1, "Veuillez confirmer le mot de passe"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })

type ResetFormData = z.infer<typeof resetSchema>

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [isSuccess, setIsSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const resetPassword = api.auth.resetPassword.useMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  })

  async function onSubmit(data: ResetFormData) {
    try {
      await resetPassword.mutateAsync({
        token,
        newPassword: data.newPassword,
      })
      setIsSuccess(true)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CheckCircleIcon className="size-6 text-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold">Mot de passe réinitialisé</h2>
        <p className="text-sm text-muted-foreground">
          Votre mot de passe a été modifié avec succès. Vous pouvez maintenant
          vous connecter avec votre nouveau mot de passe.
        </p>
        <Button className="mt-4 w-full" onClick={() => router.push("/login")}>
          Se connecter
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="newPassword"
          className="text-sm font-medium text-foreground"
        >
          Nouveau mot de passe
        </label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Au moins 8 caractères"
            autoComplete="new-password"
            autoFocus
            className="pr-9"
            {...register("newPassword")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-foreground"
        >
          Confirmer le mot de passe
        </label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirmer le mot de passe"
            autoComplete="new-password"
            className="pr-9"
            {...register("confirmPassword")}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showConfirm ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={resetPassword.isPending}
      >
        {resetPassword.isPending && (
          <Loader2Icon className="size-4 animate-spin" />
        )}
        {resetPassword.isPending
          ? "Réinitialisation en cours..."
          : "Réinitialiser le mot de passe"}
      </Button>
    </form>
  )
}
