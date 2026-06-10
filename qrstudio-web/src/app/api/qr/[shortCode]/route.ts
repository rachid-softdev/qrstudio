import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createEdgePrismaClient } from "@/server/db-edge"
import { resolveDestination } from "@/server/services/redirect.service"
import { getCountry } from "@/lib/geo"
import { parseDevice, parseOs, parseBrowser } from "@/lib/user-agent"
import { getClientIp, hashIp } from "@/lib/ip"

export const runtime = "edge"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params

  const prisma = createEdgePrismaClient()

  try {
    const qrCode = await prisma.qRCode.findUnique({
      where: { shortCode },
    })

    if (!qrCode) {
      return NextResponse.redirect(new URL("/qr-not-found", request.url), 301)
    }

    // Vérifier la corbeille AVANT le statut PAUSED
    if (qrCode.deletedAt) {
      return NextResponse.redirect(new URL("/qr-deleted", request.url), 301)
    }

    if (qrCode.status === "PAUSED") {
      return NextResponse.redirect(new URL("/qr-paused", request.url), 301)
    }

    const destination = resolveDestination({
      shortCode: qrCode.shortCode,
      type: qrCode.type,
      status: qrCode.status,
      metadata: qrCode.metadata,
      deletedAt: qrCode.deletedAt,
    })

    const ip = getClientIp(request)

    const userAgent = request.headers.get("user-agent") ?? undefined
    const referer = request.headers.get("referer") ?? undefined

    waitUntil(
      recordScanInBackground(qrCode.id, ip, userAgent, referer).catch(() => {
        /* fire-and-forget */
      })
    )

    return NextResponse.redirect(new URL(destination, request.url), 301)
  } finally {
    prisma.$disconnect().catch(() => {})
  }
}

async function recordScanInBackground(
  qrCodeId: string,
  ip: string,
  userAgent?: string,
  referer?: string
): Promise<void> {
  const ipHash = await hashIp(ip)

  let country: string | null = null
  try {
    country = await getCountry(ip)
  } catch {
    country = null
  }

  const deviceType = userAgent ? parseDevice(userAgent) : null
  const os = userAgent ? parseOs(userAgent) : null
  const browser = userAgent ? parseBrowser(userAgent) : null

  const edgePrisma = createEdgePrismaClient()

  try {
      await edgePrisma.scan.create({
        data: {
          qrCodeId,
          ipHash,
          country,
        deviceType,
        os,
        browser,
        referer: referer ?? null,
      },
    })

    await edgePrisma.qRCode.update({
      where: { id: qrCodeId },
      data: {
        totalScans: { increment: 1 },
        lastScannedAt: new Date(),
      },
    })

    const recentScan = await edgePrisma.scan.findFirst({
      where: {
        qrCodeId,
        ipHash,
        scannedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { scannedAt: "desc" },
    })

    if (!recentScan) {
      await edgePrisma.qRCode.update({
        where: { id: qrCodeId },
        data: { uniqueScans: { increment: 1 } },
      })
    }
  } finally {
    edgePrisma.$disconnect().catch(() => {})
  }
}

function waitUntil(promise: Promise<unknown>): void {
  if (typeof (globalThis as Record<string, unknown>).waitUntil === "function") {
    ;((globalThis as Record<string, unknown>).waitUntil as (p: Promise<unknown>) => void)(promise)
  } else {
    promise.catch(() => {})
  }
}
