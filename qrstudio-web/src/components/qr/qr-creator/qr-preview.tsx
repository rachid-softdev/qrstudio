"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import type { ModuleShape } from "@/lib/qr-generator"

interface QRPreviewProps {
  data: string
  fgColor: string
  bgColor: string
  moduleShape: ModuleShape
}

export function QRPreview({ data, fgColor, bgColor, moduleShape }: QRPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !data) return

    setError(false)

    QRCode.toCanvas(canvasRef.current, data, {
      width: 300,
      margin: 2,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    }, (err) => {
      if (err) {
        setError(true)
      }
    })
  }, [data, fgColor, bgColor])

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-6">
      {data ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Aperçu du QR code"
            className="rounded-lg"
            style={{ maxWidth: "100%", height: "auto" }}
          />
          {moduleShape !== "square" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Aperçu avec modules {moduleShape === "rounded" ? "arrondis" : "en points"}
            </p>
          )}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Erreur de génération</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sélectionnez un type et remplissez le contenu</p>
      )}
    </div>
  )
}
