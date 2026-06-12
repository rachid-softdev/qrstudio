import pino from "pino"

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === "production" ? "info" : "debug")

const isTest = process.env.NODE_ENV === "test"

const logger = pino({
  level,
  base: undefined,
  ...(isTest ? { enabled: false } : {}),
  serializers: {
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "totpSecret",
      "totpBackupCodes",
      "authorization",
      "cookie",
      "token",
      "sessionToken",
      "accessToken",
      "refreshToken",
    ],
    censor: "[REDACTED]",
  },
})

export default logger
