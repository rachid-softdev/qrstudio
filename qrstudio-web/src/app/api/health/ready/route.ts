import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { getStripeClient } from "@/lib/stripe"

export async function GET() {
  const checks: Record<string, { status: string; error?: string }> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: "ok" }
  } catch (e) {
    checks.database = { status: "error", error: String(e) }
  }

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      await getStripeClient().balance.retrieve()
      checks.stripe = { status: "ok" }
    } catch (e) {
      checks.stripe = { status: "error", error: String(e) }
    }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "ok")

  return NextResponse.json(
    { status: allHealthy ? "ok" : "degraded", checks },
    { status: allHealthy ? 200 : 503 }
  )
}
