import { z } from "zod"
import type { QRType } from "@/types/index"

const contentSchema = z.object({
  destinationUrl: z.string().optional(),
  wifi: z
    .object({
      ssid: z.string(),
      password: z.string().optional(),
      encryption: z.string().optional(),
    })
    .optional(),
  vcard: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  textContent: z.string().optional(),
})

function parseContent(raw: Record<string, unknown>): z.infer<typeof contentSchema> {
  const parsed = contentSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

export function computeQRData(type: QRType, content: Record<string, unknown>): string {
  const data = parseContent(content)
  switch (type) {
    case "URL":
      return data.destinationUrl ?? ""
    case "WHATSAPP": {
      const phone = data.destinationUrl ?? ""
      return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`
    }
    case "WIFI": {
      const wifi = data.wifi
      if (!wifi?.ssid) return ""
      return `WIFI:T:${wifi.encryption ?? "nopass"};S:${wifi.ssid};${wifi.password ? `P:${wifi.password};` : ""}`
    }
    case "VCARD": {
      const vcard = data.vcard
      if (!vcard?.firstName && !vcard?.lastName) return ""
      const lines = ["BEGIN:VCARD", "VERSION:3.0"]
      if (vcard.firstName || vcard.lastName) {
        lines.push(`FN:${vcard.firstName ?? ""} ${vcard.lastName ?? ""}`.trim())
        lines.push(`N:${vcard.lastName ?? ""};${vcard.firstName ?? ""};;;`)
      }
      if (vcard.email) lines.push(`EMAIL:${vcard.email}`)
      if (vcard.phone) lines.push(`TEL:${vcard.phone}`)
      if (vcard.company) lines.push(`ORG:${vcard.company}`)
      if (vcard.website) lines.push(`URL:${vcard.website}`)
      lines.push("END:VCARD")
      return lines.join("\n")
    }
    case "PDF":
      return data.destinationUrl ?? ""
    case "TEXT":
      return data.textContent ?? ""
    case "LANDING_PAGE":
      return `page_${Date.now()}`
  }
}
