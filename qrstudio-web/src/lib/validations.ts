import { z } from "zod"

export type Period = '7d' | '30d' | '90d' | 'all'

export const emailSchema = z.string().email()
export const urlSchema = z.string().url()
export const safeUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false
      }
      return true
    } catch {
      return false
    }
  },
  { message: "Seules les URLs HTTP(S) sont autorisées" }
)
export const hexColorSchema = z.string().regex(/^#[0-9A-F]{6}$/i)
export const shortCodeSchema = z.string().length(6).regex(/^[a-z0-9]+$/)

/**
 * Allowed frame types for QR code frames.
 * Values correspond to SVG filenames in public/qr-frames/frame-{type}.svg.
 * Using z.enum() prevents path traversal attacks via frameType injection.
 */
export const frameTypeSchema = z.enum([
  '1', '2', '3', '4', '5', '6',
  'bold', 'dashed', 'elegant', 'minimal', 'neon', 'rounded',
])

export const VCardSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url().optional(),
})

export const LandingPageSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ctaLabel: z.string().max(50).optional(),
  ctaUrl: safeUrlSchema.optional(),
  imageUrl: z.string().url().optional(),
  bgColor: hexColorSchema.default('#FFFFFF'),
  textColor: hexColorSchema.default('#111827'),
})

export const QRCreateSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(['URL','WHATSAPP','WIFI','VCARD','PDF','TEXT','LANDING_PAGE']),
  destinationUrl: urlSchema.optional(),
  wifi: z.object({ ssid: z.string(), password: z.string().optional(), encryption: z.enum(['WPA','WEP','nopass']) }).optional(),
  vcard: VCardSchema.optional(),
  textContent: z.string().max(2000).optional(),
  landingPage: LandingPageSchema.optional(),
  fgColor: hexColorSchema.optional(),
  bgColor: hexColorSchema.optional(),
  logoUrl: z.string().url().optional(),
  moduleShape: z.enum(['square','rounded','dots']).optional(),
  frameType: frameTypeSchema.optional(),
  frameLabel: z.string().max(50).optional(),
})

export type QRCreateInput = z.infer<typeof QRCreateSchema>

export const QRUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  destinationUrl: urlSchema.optional(),
  wifi: z.object({ ssid: z.string(), password: z.string().optional(), encryption: z.enum(['WPA','WEP','nopass']) }).optional(),
  vcard: VCardSchema.optional(),
  textContent: z.string().max(2000).optional(),
  landingPage: LandingPageSchema.optional(),
  fgColor: hexColorSchema.optional(),
  bgColor: hexColorSchema.optional(),
  logoUrl: z.string().url().optional(),
  moduleShape: z.enum(['square','rounded','dots']).optional(),
  frameType: frameTypeSchema.optional(),
  frameLabel: z.string().max(50).optional(),
})

export type QRUpdateInput = z.infer<typeof QRUpdateSchema>
