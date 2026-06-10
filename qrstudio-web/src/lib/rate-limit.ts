import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { withRetry } from "@/lib/retry"
import { withBreaker, redisBreaker } from "@/lib/circuit-breaker"
import logger from "@/lib/logger"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

const qrRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/qr",
})

const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
})

const trpcMutationLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/trpc/mutation",
})

const trpcQueryLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/trpc/query",
})

const totpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/totp",
})

/**
 * Wrapped rate limit check with circuit breaker and retry.
 * Falls back to allowing the request if Redis is unreachable.
 */
async function limitWithFallback(
  limiter: Ratelimit,
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  try {
    return await withBreaker(redisBreaker, () =>
      withRetry(() => limiter.limit(identifier), {
        maxRetries: 1,
        timeout: 1000,
      }),
    )
  } catch {
    logger.warn("Rate limit unavailable, allowing request")
    return { success: true, remaining: 1, limit: 1, reset: 0 }
  }
}

/** QR code rate limit with retry + circuit breaker fallback */
export async function checkQrRateLimit(
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  return limitWithFallback(qrRateLimit, identifier)
}

/** Auth rate limit with retry + circuit breaker fallback */
export async function checkAuthRateLimit(
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  return limitWithFallback(authRateLimit, identifier)
}

/** tRPC mutation rate limit with retry + circuit breaker fallback */
export async function checkTrpcMutationLimit(
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  return limitWithFallback(trpcMutationLimit, identifier)
}

/** tRPC query rate limit with retry + circuit breaker fallback */
export async function checkTrpcQueryLimit(
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  return limitWithFallback(trpcQueryLimit, identifier)
}

/** TOTP rate limit with retry + circuit breaker fallback */
export async function checkTotpRateLimit(
  identifier: string,
): Promise<{ success: boolean; remaining: number; limit: number; reset: number }> {
  return limitWithFallback(totpRateLimit, identifier)
}
