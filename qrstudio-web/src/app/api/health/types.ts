export interface CheckResult {
  status: "ok" | "error" | "not_configured"
  error?: string
  queueSize?: number
  dlqCount?: number
}

export interface HealthResponse {
  status: "ok" | "degraded"
  timestamp: string
  version: string
  checks: {
    database: CheckResult
    redis: CheckResult
    pgBoss: CheckResult
    dlq: CheckResult
  }
}
