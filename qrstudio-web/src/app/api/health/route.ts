import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { withRetry } from "@/lib/retry"
import { Redis } from "@upstash/redis"
import type { CheckResult, HealthResponse } from "./types"

// ── Probe helpers ──────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  try {
    await withRetry(() => prisma.$queryRaw`SELECT 1`, {
      maxRetries: 1,
      timeout: 5000,
    })
    return { status: "ok" }
  } catch (error) {
    return { status: "error", error: String(error) }
  }
}

async function checkRedis(): Promise<CheckResult> {
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    return { status: "not_configured" }
  }
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
    await withRetry(() => redis.ping(), {
      maxRetries: 1,
      timeout: 2000,
    })
    return { status: "ok" }
  } catch (error) {
    return { status: "error", error: String(error) }
  }
}

async function checkPgBoss(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) {
    return { status: "not_configured" }
  }
  try {
    const { getQueue, QUEUE_NAMES } = await import("@/server/queue")
    const queue = await withRetry(() => getQueue(), {
      maxRetries: 1,
      timeout: 5000,
    })
    const stats = await queue.getQueueStats(QUEUE_NAMES.RECORD_SCAN)
    return { status: "ok", queueSize: stats.totalCount }
  } catch (error) {
    return { status: "error", error: String(error) }
  }
}

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET() {
  const [database, redis, pgBoss] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkPgBoss(),
  ])

  const checks = { database, redis, pgBoss }
  const allOk = Object.values(checks).every(
    (c) => c.status === "ok" || c.status === "not_configured",
  )

  const body: HealthResponse = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    checks,
  }

  return NextResponse.json(body, { status: allOk ? 200 : 503 })
}
