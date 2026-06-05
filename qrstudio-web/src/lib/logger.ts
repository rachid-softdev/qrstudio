const IS_DEV = process.env.NODE_ENV !== "production"

const logger = {
  info: (msg: string, ...args: unknown[]) => {
    if (IS_DEV) console.log(`[INFO] ${msg}`, ...args)
    // En production, utiliser un vrai logger JSON (pino ou équivalent)
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args)
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${msg}`, ...args)
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (IS_DEV) console.debug(`[DEBUG] ${msg}`, ...args)
  },
}

export default logger
