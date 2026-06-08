"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Loader2Icon, ShieldAlertIcon, ArrowLeftIcon } from "lucide-react"

function TotpChallengeForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { update } = useSession()
  const partialToken = searchParams.get("partialToken")
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"

  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"totp" | "backup">("totp")
  const [backupCode, setBackupCode] = useState("")

  const verifyMutation = api.auth.verifyTotpChallenge.useMutation({
    onSuccess: async () => {
      // Update session to clear needsTotp (triggers JWT callback → DB check)
      await update()
      router.push(callbackUrl)
      router.refresh()
    },
    onError: (err) => {
      setError(err.message)
      setToken("")
    },
  })

  const backupMutation = api.auth.verifyBackupCode.useMutation({
    onSuccess: async () => {
      await update()
      router.push(callbackUrl)
      router.refresh()
    },
    onError: (err) => {
      setError(err.message)
      setBackupCode("")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!partialToken) {
      setError("Session invalide. Veuillez vous reconnecter.")
      return
    }

    if (mode === "totp") {
      if (token.length !== 6 || !/^\d{6}$/.test(token)) {
        setError("Le code doit contenir exactement 6 chiffres")
        return
      }
      verifyMutation.mutate({ partialToken, token })
    } else {
      if (backupCode.length !== 8) {
        setError("Le code de secours doit contenir exactement 8 caractères")
        return
      }
      backupMutation.mutate({ partialToken, backupCode })
    }
  }

  function switchToBackup() {
    setMode("backup")
    setError("")
    setToken("")
  }

  function switchToTotp() {
    setMode("totp")
    setError("")
    setBackupCode("")
  }

  if (!partialToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlertIcon className="size-6 text-destructive" />
            </div>
            <CardTitle>Session invalide</CardTitle>
            <CardDescription>
              Cette page nécessite un jeton d&apos;authentification.
              Veuillez vous connecter à nouveau.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => router.push("/login")}
            >
              Retour à la connexion
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const isPending = verifyMutation.isPending || backupMutation.isPending

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldAlertIcon className="size-6 text-primary" />
          </div>
          <CardTitle>Authentification à deux facteurs</CardTitle>
          <CardDescription>
            {mode === "totp"
              ? "Saisissez le code à 6 chiffres généré par votre application d'authentification."
              : "Saisissez un code de secours à usage unique."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "totp" ? (
              <div className="space-y-2">
                <label htmlFor="totp-code" className="text-sm font-medium">
                  Code à 6 chiffres
                </label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={token}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setToken(value)
                  }}
                  disabled={isPending}
                  className="text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="backup-code" className="text-sm font-medium">
                  Code de secours
                </label>
                <Input
                  id="backup-code"
                  type="text"
                  placeholder="ABCD1234"
                  maxLength={8}
                  value={backupCode}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 8)
                    setBackupCode(value)
                  }}
                  disabled={isPending}
                  className="text-center text-lg tracking-widest uppercase"
                  autoFocus
                />
              </div>
            )}

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2Icon className="size-4 animate-spin" />}
              {isPending
                ? "Vérification..."
                : mode === "totp"
                  ? "Vérifier"
                  : "Valider le code de secours"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            {mode === "totp" ? (
              <button
                type="button"
                onClick={switchToBackup}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
                disabled={isPending}
              >
                Utiliser un code de secours
              </button>
            ) : (
              <button
                type="button"
                onClick={switchToTotp}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline"
                disabled={isPending}
              >
                <ArrowLeftIcon className="size-3" />
                Revenir au code TOTP
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TotpChallengePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Authentification à deux facteurs</CardTitle>
              <CardDescription>Chargement…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <TotpChallengeForm />
    </Suspense>
  )
}
