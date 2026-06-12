"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangleIcon, RefreshCwIcon, LayoutDashboardIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24" role="alert">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangleIcon className="size-7 text-destructive" />
      </div>
      <div className="max-w-sm space-y-2 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Une erreur est survenue sur cette page
        </h2>
        <p className="text-sm text-muted-foreground">
          Le chargement de cette section a échoué. Vous pouvez réessayer ou
          revenir au tableau de bord.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={reset} size="sm">
          <RefreshCwIcon className="mr-1.5 size-4" />
          Réessayer
        </Button>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <LayoutDashboardIcon className="mr-1.5 size-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
