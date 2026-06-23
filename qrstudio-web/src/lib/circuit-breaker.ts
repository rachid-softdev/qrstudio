import logger from "@/lib/logger"

interface BreakerOptions {
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  name: string
}

// Edge Runtime (Next.js middleware) does not support the full Node.js API
// that opossum requires. We fall back to a simple passthrough breaker.
type CircuitBreakerInstance = {
  fire: (fn: (...args: unknown[]) => Promise<unknown>) => Promise<unknown>
  on: (event: string, cb: () => void) => void
}

const defaults = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
}

function createBreakerFallback(
  fn: (...args: unknown[]) => Promise<unknown>,
  _opts: BreakerOptions,
): CircuitBreakerInstance {
  return {
    fire: (f) => f(),
    on: () => {},
  }
}

let createBreakerImpl: typeof createBreakerFallback

try {
  // Dynamic import — fails gracefully in Edge Runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CircuitBreaker = require("opossum").default ?? require("opossum")

  createBreakerImpl = function createBreaker(
    fn: (...args: unknown[]) => Promise<unknown>,
    opts: BreakerOptions,
  ) {
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
} catch {
  // Edge Runtime fallback
  createBreakerImpl = createBreakerFallback
}

const createBreaker = createBreakerImpl

export const stripeBreaker: CircuitBreakerInstance = createBreaker(
  async (...args: unknown[]) => {
    const fn = args[0] as () => Promise<unknown>
    return fn()
  },
  {
    name: "stripe",
    timeout: 15000,
  },
)

export const redisBreaker: CircuitBreakerInstance = createBreaker(
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

export const resendBreaker: CircuitBreakerInstance = createBreaker(
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
  breaker: CircuitBreakerInstance,
  fn: () => Promise<T>,
): Promise<T> {
  return breaker.fire(fn as unknown as (...args: unknown[]) => Promise<unknown>) as Promise<T>
}
