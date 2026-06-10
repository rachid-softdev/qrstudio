import { Redis } from "@upstash/redis"
import type { Period } from "@/lib/validations"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

const ANALYTICS_TTL = 60 // seconds
const DASHBOARD_TTL = 30 // seconds

/**
 * Read-through cache helper: try Redis, fallback to compute, write to Redis.
 * The cache write is fire-and-forget (never blocks the response).
 * If Redis is unavailable, degrades gracefully to direct computation.
 */
export async function readWithCache<T>(
  key: string,
  ttl: number,
  compute: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get<T>(key)
    if (cached !== null) return cached
  } catch {
    // Redis unavailable — fall through to compute
  }

  const data = await compute()
  redis.setex(key, ttl, JSON.stringify(data)).catch(() => {})
  return data
}

/**
 * Invalidate all analytics cache keys for a given QR code.
 */
export async function invalidateAnalyticsCache(qrCodeId: string): Promise<void> {
  try {
    const periods: Period[] = ["7d", "30d", "90d", "all"]
    const pipeline = redis.pipeline()
    for (const period of periods) {
      pipeline.del(`analytics:${qrCodeId}:${period}`)
    }
    await pipeline.exec()
  } catch {
    // Redis unavailable — cache invalidation is best-effort
  }
}

/**
 * Invalidate the dashboard cache for a workspace.
 */
export async function invalidateDashboardCache(workspaceId: string): Promise<void> {
  try {
    await redis.del(`dashboard:${workspaceId}`)
  } catch {
    // Redis unavailable — cache invalidation is best-effort
  }
}

export function analyticsCacheKey(qrCodeId: string, period: Period): string {
  return `analytics:${qrCodeId}:${period}`
}

export function dashboardCacheKey(workspaceId: string): string {
  return `dashboard:${workspaceId}`
}

export { ANALYTICS_TTL, DASHBOARD_TTL }
