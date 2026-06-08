"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import QRCode from "qrcode"
import { Loader2Icon, CheckCircle2Icon, DownloadIcon, CopyIcon, CheckIcon, ShieldAlertIcon, ShieldIcon, KeyIcon } from "lucide-react"
import { api } from "@/lib/trpc/client"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { TRPCClientError } from "@trpc/client"

type SetupStep = "generate" | "verify" | "backup-codes"

export default function SecuritySettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const totpEnabled = session?.user?.totpEnabled ?? false

  // ─── Enable TOTP dialog ──────────────────────────────────────────────────

  const [enableDialogOpen, setEnableDialogOpen] = useState(false)
  const [setupStep, setSetupStep] = useState<SetupStep>("generate")
  const [totpToken, setTotpToken] = useState("")
  const [verificationError, setVerificationError] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [codesCopied, setCodesCopied] = useState(false)
  const [codesConfirmed, setCodesConfirmed] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)

  const setupQuery = api.auth.generateTotpSetup.useQuery(undefined, {
    enabled: enableDialogOpen && setupStep === "generate",
    retry: false,
  })

  const uri = setupQuery.data?.uri

  // Handle query errors
  useEffect(() => {
    if (setupQuery.error) {
      toast.error(setupQuery.error.message)
      setQrError(true)
    }
  }, [setupQuery.error])

  useEffect(() => {
    if (!uri) return
    setQrDataUrl(null)
    setQrError(false)
    QRCode.toDataURL(uri, {
      width: 240,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {
        setQrError(true)
        toast.error("Erreur lors de la génération du QR code")
      })
  }, [uri])

  const verifyMutation = api.auth.verifyAndEnableTotp.useMutation({
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes)
      setSetupStep("backup-codes")
      toast.success("Authentification à deux facteurs activée")
    },
    onError: (err) => {
      setVerificationError(err.message)
    },
  })

  function resetEnableFlow() {
    setEnableDialogOpen(false)
    setSetupStep("generate")
    setTotpToken("")
    setVerificationError("")
    setBackupCodes([])
    setCodesCopied(false)
    setCodesConfirmed(false)
    setQrDataUrl(null)
    setQrError(false)
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) {
      if (setupStep === "backup-codes" && !codesConfirmed) {
        return // Prevent closing until codes are confirmed
      }
      resetEnableFlow()
    } else {
      setEnableDialogOpen(true)
    }
  }

  function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault()
    setVerificationError("")

    if (totpToken.length !== 6 || !/^\d{6}$/.test(totpToken)) {
      setVerificationError("Le code doit contenir exactement 6 chiffres")
      return
    }

    verifyMutation.mutate({ token: totpToken })
  }

  function handleCopyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCodesCopied(true)
      toast.success("Codes de secours copiés")
      setTimeout(() => setCodesCopied(false), 3000)
    })
  }

  function handleDownloadBackupCodes() {
    const content = backupCodes.join("\n")
    const blob = new Blob([`Codes de secours QR Studio — ${new Date().toLocaleDateString("fr-FR")}\n${"=".repeat(40)}\n\n${content}\n\n${"=".repeat(40)}\nConservez ces codes en lieu sûr. Chaque code ne peut être utilisé qu'une seule fois.\n`], {
      type: "text/plain",
    })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement("a")
    a.href = url
    a.download = `qrstudio-backup-codes-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Codes de secours téléchargés")
  }

  function handleConfirmBackupCodes() {
    setCodesConfirmed(true)
    resetEnableFlow()
    updateSession()
  }

  // ─── Disable TOTP dialog ─────────────────────────────────────────────────

  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableError, setDisableError] = useState("")

  const disableMutation = api.auth.disableTotp.useMutation({
    onSuccess: () => {
      setDisableDialogOpen(false)
      setDisablePassword("")
      setDisableError("")
      toast.success("Authentification à deux facteurs désactivée")
      updateSession()
    },
    onError: (err) => {
      if (
        err instanceof TRPCClientError &&
        err.message === "Mot de passe incorrect"
      ) {
        setDisableError("Mot de passe incorrect")
      } else {
        setDisableError(err.message)
      }
    },
  })

  function handleDisableTotp() {
    if (!disablePassword) {
      setDisableError("Mot de passe requis")
      return
    }
    setDisableError("")
    disableMutation.mutate({ password: disablePassword })
  }

  function handleDisableDialogOpenChange(open: boolean) {
    setDisableDialogOpen(open)
    if (!open) {
      setDisablePassword("")
      setDisableError("")
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <Header
        title="Sécurité"
        description="Gérez les paramètres de sécurité de votre compte"
      />

      {/* ─── Password section (already in main settings page, kept for completeness) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Authentification à deux facteurs (2FA)</h2>
          <p className="text-sm text-muted-foreground">
            Renforcez la sécurité de votre compte avec une application d&apos;authentification
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>État de la 2FA</CardTitle>
            <CardDescription>
              {totpEnabled
                ? "Votre compte est protégé par une authentification à deux facteurs."
                : "Ajoutez une couche de sécurité supplémentaire à votre compte."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {totpEnabled ? (
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <ShieldIcon className="size-5 text-emerald-500" />
                  </div>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <ShieldAlertIcon className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {totpEnabled ? "2FA activée" : "2FA désactivée"}
                  </p>
                  <Badge
                    variant={totpEnabled ? "default" : "outline"}
                    className="mt-0.5"
                  >
                    {totpEnabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {totpEnabled ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDisableDialogOpen(true)}
                >
                  Désactiver
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setEnableDialogOpen(true)}
                >
                  Activer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Enable TOTP Dialog ─────────────────────────────────────────── */}
      <Dialog open={enableDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          {setupStep === "generate" && (
            <>
              <DialogHeader>
                <DialogTitle>Configurer la 2FA</DialogTitle>
                <DialogDescription>
                  Étape 1 sur 3 — Scannez le QR code avec votre application d&apos;authentification
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center gap-4 py-4">
                {setupQuery.isFetching && (
                  <div className="flex size-60 items-center justify-center">
                    <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!setupQuery.isFetching && qrDataUrl && (
                  <div className="rounded-xl border bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt="QR code pour l'application d'authentification"
                      className="size-60"
                      width={240}
                      height={240}
                    />
                  </div>
                )}

                {!setupQuery.isFetching && qrError && (
                  <div className="flex size-60 items-center justify-center rounded-xl border bg-muted">
                    <p className="text-sm text-muted-foreground">
                      Erreur de génération
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">
                    Applications compatibles
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Google Authenticator, Authy, Microsoft Authenticator, 1Password…
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-sm text-muted-foreground">
                  Vous ne pouvez pas scanner le QR code ?
                </p>
                {setupQuery.data?.secret && (
                  <div className="w-full max-w-xs">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Clé secrète :
                    </p>
                    <code className="block overflow-hidden rounded-md border bg-muted px-3 py-2 text-center text-xs tracking-wider">
                      {setupQuery.data.secret}
                    </code>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={resetEnableFlow}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => setSetupStep("verify")}
                  disabled={setupQuery.isFetching || !!qrError}
                >
                  Code scanné
                </Button>
              </div>
            </>
          )}

          {setupStep === "verify" && (
            <>
              <DialogHeader>
                <DialogTitle>Configurer la 2FA</DialogTitle>
                <DialogDescription>
                  Étape 2 sur 3 — Saisissez le code à 6 chiffres de votre application
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleVerifyTotp} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="verify-totp-code" className="text-sm font-medium">
                    Code de vérification
                  </label>
                  <Input
                    id="verify-totp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={totpToken}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                      setTotpToken(value)
                    }}
                    disabled={verifyMutation.isPending}
                    className="text-center text-lg tracking-widest"
                    autoFocus
                  />
                </div>

                {verificationError && (
                  <p className="text-center text-sm text-destructive">
                    {verificationError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSetupStep("generate")}
                    disabled={verifyMutation.isPending}
                  >
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending && (
                      <Loader2Icon className="size-4 animate-spin" />
                    )}
                    Vérifier et activer
                  </Button>
                </div>
              </form>
            </>
          )}

          {setupStep === "backup-codes" && (
            <>
              <DialogHeader>
                <DialogTitle>Codes de secours</DialogTitle>
                <DialogDescription>
                  Étape 3 sur 3 — Ces codes à usage unique vous permettront de vous connecter
                  si vous perdez l&apos;accès à votre application d&apos;authentification.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Important :</strong> Téléchargez ou copiez ces codes
                    maintenant. Ils ne seront plus jamais affichés.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm tracking-wider"
                    >
                      <KeyIcon className="size-3 shrink-0 text-muted-foreground" />
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyBackupCodes}
                  >
                    {codesCopied ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                    {codesCopied ? "Copié" : "Copier"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadBackupCodes}
                  >
                    <DownloadIcon className="size-3" />
                    Télécharger
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3 pt-2">
                <input
                  id="confirm-backup-codes"
                  type="checkbox"
                  checked={codesConfirmed}
                  onChange={(e) => setCodesConfirmed(e.target.checked)}
                  className="mt-1 size-4 rounded border-input"
                />
                <label
                  htmlFor="confirm-backup-codes"
                  className="text-sm text-muted-foreground"
                >
                  J&apos;ai sauvegardé mes codes de secours dans un endroit sûr
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={resetEnableFlow}
                >
                  Fermer
                </Button>
                <Button
                  onClick={handleConfirmBackupCodes}
                  disabled={!codesConfirmed}
                >
                  <CheckCircle2Icon className="size-4" />
                  Confirmer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Disable TOTP Dialog ────────────────────────────────────────── */}
      <AlertDialog
        open={disableDialogOpen}
        onOpenChange={handleDisableDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver la 2FA</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de désactiver l&apos;authentification à deux facteurs.
              Votre compte sera moins sécurisé. Pour confirmer, saisissez votre mot de passe.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label htmlFor="disable-password" className="text-sm font-medium">
              Mot de passe
            </label>
            <Input
              id="disable-password"
              type="password"
              placeholder="Votre mot de passe actuel"
              value={disablePassword}
              onChange={(e) => {
                setDisablePassword(e.target.value)
                setDisableError("")
              }}
              disabled={disableMutation.isPending}
              autoFocus
            />
            {disableError && (
              <p className="text-xs text-destructive">{disableError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={disableMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableTotp}
              disabled={disableMutation.isPending || !disablePassword}
              className="bg-destructive hover:bg-destructive/90"
            >
              {disableMutation.isPending && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
