import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(),
  },
}))

import QRCode from "qrcode"
import { generateQRSvg } from "@/lib/qr-generator"

describe("generateQRSvg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return a valid SVG string", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect/><rect fill="#ffffff"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "square",
    })

    expect(svg).toContain("<svg")
    expect(svg).toContain("<rect")
  })

  it("should apply fgColor and bgColor", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect fill="#000000"/><rect fill="#ffffff"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#FF0000",
      bgColor: "#00FF00",
      moduleShape: "square",
    })

    expect(svg).toContain('fill="#FF0000"')
    expect(svg).toContain('fill="#00FF00"')
  })

  it("should generate <rect rx=\"...\"> for rounded moduleShape", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="1" height="1"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "rounded",
    })

    expect(svg).toContain('rx="3"')
    expect(svg).toContain('ry="3"')
  })

  it("should generate <circle> for dots moduleShape", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(QRCode.toString as any).mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="1" height="1" x="0" y="0"/></svg>'
    )

    const svg = await generateQRSvg("https://example.com", {
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      moduleShape: "dots",
    })

    expect(svg).toContain("<circle")
    expect(svg).not.toContain("<rect")
  })
})
