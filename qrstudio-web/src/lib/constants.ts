export const PLAN_LIMITS = {
  FREE: { maxQRCodes: 5, maxTeamMembers: 1, analyticsRetentionDays: 30, bulkGeneration: false, apiAccess: false, customDomain: false },
  PRO: { maxQRCodes: 100, maxTeamMembers: 5, analyticsRetentionDays: 365, bulkGeneration: true, apiAccess: true, customDomain: false },
  AGENCY: { maxQRCodes: Infinity, maxTeamMembers: Infinity, analyticsRetentionDays: Infinity, bulkGeneration: true, apiAccess: true, customDomain: true },
} as const

export const QR_TYPES = ['URL','WHATSAPP','WIFI','VCARD','PDF','TEXT','LANDING_PAGE'] as const
export const MODULE_SHAPES = ['square','rounded','dots'] as const
export const SHORT_CODE_LENGTH = 6
export const FRAME_TYPES = ['1', '2', '3', '4', '5', '6', 'bold', 'dashed', 'elegant', 'minimal', 'neon', 'rounded'] as const

export const MAX_FILE_SIZE = {
  LOGO: 500 * 1024,
  PDF: 10 * 1024 * 1024,
}

export const AUTH = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  PARTIAL_TOKEN_TTL: "5m",
  TOTP_ISSUER: "QR Studio",
} as const

export const DATABASE = {
  QUERY_TIMEOUT_MS: 15_000,
} as const
