import CircuitBreaker from "opossum"
import logger from "@/lib/logger"

interface BreakerOptions {
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  name: string
}

const defaults = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
}

function createBreaker(
  fn: (...args: unknown[]) => Promise<unknown>,
  opts: BreakerOptions,
): CircuitBreaker {
  const breaker = new CircuitBreaker(fn, { ...defaults, ...opts })

  breaker.on("open", () =>
    logger.warn({ breaker: opts.name }, "Circuit breaker ouvert"),
  )
  breaker.on("halfOpen", () =>
    logger.warn({ breaker: opts.name }, "Circuit breaker entrouvert"),
  )
  breaker.on("close", () =>
    logger.info({ breaker: opts.name }, "Circuit breaker fermé"),
  )

  return breaker
}

export const stripeBreaker = createBreaker(
  async (...args: unknown[]) => {
    const fn = args[0] as () => Promise<unknown>
    return fn()
  },
  {
    name: "stripe",
    timeout: 15000,
  },
)

export const redisBreaker = createBreaker(
  async (...args: unknown[]) => {
    const fn = args[0] as () => Promise<unknown>
    return fn()
  },
  {
    name: "redis",
    timeout: 2000,
    resetTimeout: 10000,
  },
)

export const resendBreaker = createBreaker(
  async (...args: unknown[]) => {
    const fn = args[0] as () => Promise<unknown>
    return fn()
  },
  {
    name: "resend",
    timeout: 15000,
  },
)

export function withBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
): Promise<T> {
  return breaker.fire(fn as unknown as (...args: unknown[]) => Promise<unknown>) as Promise<T>
}
