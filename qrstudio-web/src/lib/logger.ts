import pino from "pino"

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === "production" ? "info" : "debug")

const logger = pino({
  level,
  base: undefined,
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
  // Pretty-print only in development (not test or production)
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
})

export default logger
