import { createHmac } from "crypto"

let ipHashSecret: string | null = null
function getIpHashSecret(): string {
  if (!ipHashSecret) {
    ipHashSecret = process.env.IP_HASH_SECRET ?? ""
    if (!ipHashSecret) {
      console.warn("[ip] IP_HASH_SECRET not set — using fallback derivation (less secure)")
      ipHashSecret = "qr-studio-fallback-secret-do-not-use-in-production"
    }
  }
  return ipHashSecret
}

/**
 * Extracts the true client IP from a request, respecting reverse proxy headers.
 * - Production: x-real-ip → cf-connecting-ip → rightmost non-private x-forwarded-for
 * - Dev: x-real-ip → leftmost x-forwarded-for
 */
export function getClientIp(request: { headers: Headers }): string {
  const headers = request.headers

  // 1. x-real-ip (Vercel edge, trusted proxy)
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp

  // 2. cf-connecting-ip (Cloudflare)
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp) return cfIp

  // 3. x-forwarded-for chain
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const ips = forwarded.split(",").map(s => s.trim()).filter(Boolean)
    if (ips.length > 0) {
      const isDev = process.env.NODE_ENV === "development"
      if (isDev) {
        // In dev, trust leftmost (no proxy)
        return ips[0]
      }
      // In production, take rightmost non-private IP
      for (let i = ips.length - 1; i >= 0; i--) {
        const ip = ips[i]
        if (!isPrivateIp(ip)) return ip
      }
      // All private — return rightmost as last resort
      return ips[ips.length - 1]
    }
  }

  return "unknown"
}

function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  if (ip.startsWith("10.")) return true
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  if (ip.startsWith("192.168.")) return true
  if (ip === "127.0.0.1" || ip === "::1") return true
  return false
}

/**
 * Hashes an IP using HMAC-SHA256 with the configured IP_HASH_SECRET.
 * Works in both Node.js and Edge runtimes.
 */
export async function hashIp(ip: string): Promise<string> {
  const secret = getIpHashSecret()

  // Detect Edge Runtime (Web Crypto available, no createHmac)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip))
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  // Node.js runtime
  return createHmac("sha256", secret).update(ip).digest("hex")
}
