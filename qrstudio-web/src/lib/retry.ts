import logger from "@/lib/logger"

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  timeout?: number
  shouldRetry?: (error: Error) => boolean
}

export class RetryError extends Error {
  public readonly attempts: number
  public readonly cause: Error | undefined

  constructor(message: string, attempts: number, cause?: Error) {
    super(message)
    this.name = "RetryError"
    this.attempts = attempts
    this.cause = cause
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * delay * 0.5
  return Math.min(delay + jitter, maxDelay)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeout: timeoutMs,
    shouldRetry: shouldRetryFn = () => true,
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result: T = timeoutMs
        ? await Promise.race([
            fn(),
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
            ),
          ])
        : await fn()

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      lastError = err

      if (attempt >= maxRetries || !shouldRetryFn(err)) {
        throw new RetryError(
          `Operation failed after ${attempt} attempt(s)`,
          attempt,
          err
        )
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay)
      logger.warn(
        { attempt, maxRetries, delay, err: err.message },
        "Retrying operation after error",
      )
      await sleep(delay)
    }
  }

  throw new RetryError(
    `Operation failed after ${maxRetries} attempt(s)`,
    maxRetries,
    lastError
  )
}
