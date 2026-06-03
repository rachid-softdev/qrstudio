import { describe, it, expect } from "vitest"
import { parseDevice, parseOs, parseBrowser } from "@/lib/user-agent"

// Real user agent strings
const UAs = {
  // Mobile
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  safariIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",

  // Tablet
  iPadSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",

  // Desktop
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  firefoxMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",

  // Other browsers
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
  ie11:
    "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
  chromeOS:
    "Mozilla/5.0 (X11; CrOS x86_64 14526.89.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

  // Edge cases
  empty: "",
  unknownBot: "curl/7.68.0",
  linuxDesktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

describe("parseDevice", () => {
  it.each([
    { ua: UAs.chromeAndroid, expected: "mobile" },
    { ua: UAs.safariIOS, expected: "mobile" },
    { ua: UAs.iPadSafari, expected: "tablet" },
    { ua: UAs.chromeWindows, expected: "desktop" },
    { ua: UAs.firefoxMac, expected: "desktop" },
    { ua: UAs.safariMac, expected: "desktop" },
    { ua: UAs.edgeWindows, expected: "desktop" },
    { ua: UAs.linuxDesktop, expected: "desktop" },
  ])("should return '$expected' for $ua substring", ({ ua, expected }) => {
    expect(parseDevice(ua)).toBe(expected)
  })

  it("should return 'desktop' for empty user agent", () => {
    expect(parseDevice("")).toBe("desktop")
  })

  it("should return 'desktop' for unknown bot user agent", () => {
    expect(parseDevice(UAs.unknownBot)).toBe("desktop")
  })
})

describe("parseOs", () => {
  it.each([
    { ua: UAs.chromeWindows, expected: "Windows" },
    { ua: UAs.edgeWindows, expected: "Windows" },
    { ua: UAs.firefoxMac, expected: "macOS" },
    { ua: UAs.safariMac, expected: "macOS" },
    { ua: UAs.chromeAndroid, expected: "Android" },
    { ua: UAs.safariIOS, expected: "iOS" },
    { ua: UAs.iPadSafari, expected: "iOS" },
    { ua: UAs.chromeOS, expected: "Chrome OS" },
    { ua: UAs.linuxDesktop, expected: "Linux" },
  ])("should return '$expected' for $ua substring", ({ ua, expected }) => {
    expect(parseOs(ua)).toBe(expected)
  })

  it("should return 'Autre' for empty user agent", () => {
    expect(parseOs("")).toBe("Autre")
  })

  it("should return 'Autre' for unknown bot user agent", () => {
    expect(parseOs(UAs.unknownBot)).toBe("Autre")
  })
})

describe("parseBrowser", () => {
  it.each([
    { ua: UAs.chromeAndroid, expected: "Chrome" },
    { ua: UAs.chromeWindows, expected: "Chrome" },
    { ua: UAs.linuxDesktop, expected: "Chrome" },
    { ua: UAs.chromeOS, expected: "Chrome" },
    { ua: UAs.firefoxMac, expected: "Firefox" },
    { ua: UAs.safariIOS, expected: "Safari" },
    { ua: UAs.safariMac, expected: "Safari" },
    { ua: UAs.iPadSafari, expected: "Safari" },
    { ua: UAs.edgeWindows, expected: "Edge" },
    { ua: UAs.operaWindows, expected: "Opera" },
    { ua: UAs.ie11, expected: "Internet Explorer" },
  ])("should return '$expected' for $ua substring", ({ ua, expected }) => {
    expect(parseBrowser(ua)).toBe(expected)
  })

  it("should return 'Autre' for empty user agent", () => {
    expect(parseBrowser("")).toBe("Autre")
  })

  it("should return 'Autre' for unknown bot user agent", () => {
    expect(parseBrowser(UAs.unknownBot)).toBe("Autre")
  })
})
