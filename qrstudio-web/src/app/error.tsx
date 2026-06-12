"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangleIcon, RefreshCwIcon, HelpCircleIcon, MailIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4" role="alert">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangleIcon className="size-8 text-destructive" />
      </div>
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-muted-foreground">
          Désolé, un problème inattendu s&apos;est produit. Notre équipe a été
          informée automatiquement. Si le problème persiste, n&apos;hésitez pas à
          nous contacter.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCwIcon className="mr-1.5 size-4" />
          Réessayer
        </Button>
        <Link href="/dashboard/aide">
          <Button variant="outline">
            <HelpCircleIcon className="mr-1.5 size-4" />
            Consulter l&apos;aide
          </Button>
        </Link>
      </div>
      <a
        href="mailto:support@qrstudio.app"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <MailIcon className="size-3.5" />
        support@qrstudio.app
      </a>
      {process.env.NODE_ENV === "development" && (
        <details className="max-w-lg rounded-lg border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Détails techniques (développement)
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-destructive">
            {error.message}
            {"\n"}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}
