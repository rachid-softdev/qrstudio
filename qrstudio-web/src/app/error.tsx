"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground">
        Nous avons été informés du problème. Veuillez réessayer.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Réessayer
      </button>
    </div>
  )
}
