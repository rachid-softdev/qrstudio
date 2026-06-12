import type { Metadata } from "next"
import Link from "next/link"
import { PauseIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/logo"

export const metadata: Metadata = {
  title: "QR Code en pause — QR Studio",
}

export default function QRPausedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
        <PauseIcon className="size-8 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">QR Code en pause</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ce QR code a été mis en pause par son propriétaire.
        Il sera de nouveau accessible une fois réactivé.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="default" size="sm">
          Retour à l&apos;accueil
        </Button>
      </Link>
    </div>
  )
}
