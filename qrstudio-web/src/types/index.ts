export type QRType = "URL" | "WHATSAPP" | "WIFI" | "VCARD" | "PDF" | "TEXT" | "LANDING_PAGE"
export type Plan = "FREE" | "PRO" | "AGENCY"
export type Role = "OWNER" | "EDITOR" | "VIEWER"
export type QRStatus = "ACTIVE" | "PAUSED"

export interface QRCodeSummary {
  id: string
  shortCode: string
  name: string
  type: QRType
  status: QRStatus
  totalScans: number
  lastScannedAt: Date | null
  createdAt: Date
}

export interface ScanData {
  qrCodeId: string
  ipHash?: string | null
  country?: string | null
  city?: string | null
  deviceType?: string | null
  os?: string | null
  browser?: string | null
  referer?: string | null
}

export interface AnalyticsData {
  totalScans: number
  uniqueScans: number
  scansByDay: { date: string; scans: number }[]
  byCountry: { country: string; scans: number }[]
  byDevice: { device: string; scans: number }[]
  byOs: { os: string; scans: number }[]
}

export interface DashboardStats {
  totalScansToday: number
  totalQRCodes: number
  totalMembers: number
  scansLast7Days: { date: string; scans: number }[]
  topQRCodes: QRCodeSummary[]
  recentQRCodes: QRCodeSummary[]
}

export interface PlanLimits {
  maxQRCodes: number | typeof Infinity
  maxTeamMembers: number | typeof Infinity
  analyticsRetentionDays: number | typeof Infinity
  bulkGeneration: boolean
  apiAccess: boolean
  customDomain: boolean
}
