import type { QRType } from "@/types/index"
import type { QRCreateInput } from "@/lib/validations"

export function computeQRData(type: QRType, content: Partial<QRCreateInput>): string {
  switch (type) {
    case "URL":
      return content.destinationUrl ?? ""
    case "WHATSAPP": {
      const phone = content.destinationUrl ?? ""
      return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`
    }
    case "WIFI": {
      const wifi = content.wifi
      if (!wifi?.ssid) return ""
      return `WIFI:T:${wifi.encryption ?? "nopass"};S:${wifi.ssid};${wifi.password ? `P:${wifi.password};` : ""}`
    }
    case "VCARD": {
      const vcard = content.vcard
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
      return content.destinationUrl ?? ""
    case "TEXT":
      return content.textContent ?? ""
    case "LANDING_PAGE":
      return `page_${Date.now()}`
  }
}
