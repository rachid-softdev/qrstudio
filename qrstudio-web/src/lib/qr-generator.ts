import QRCode from 'qrcode'
import { URL } from 'url'
import dns from 'dns/promises'
import http from 'http'
import https from 'https'
import net from 'net'

const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^::1$/, /^(fc|fd)00:/, /^fe80:/,
]

function isPrivateHost(hostname: string): boolean {
  // Normalize IPv6-mapped IPv4 (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalized = hostname.replace(
    /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i,
    '$1'
  )
  return PRIVATE_IP_RANGES.some((range) => range.test(normalized))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpLib: any = null

async function getSharp() {
  if (!sharpLib) {
    try {
      sharpLib = (await import('sharp')).default
    } catch {
      throw new Error('sharp is required for image processing')
    }
  }
  return sharpLib
}

export type ModuleShape = 'square' | 'rounded' | 'dots'

export type QRDesignOptions = {
  fgColor: string
  bgColor: string
  moduleShape: ModuleShape
  logoUrl?: string
  frameType?: string
  frameLabel?: string
}

/**
 * Validate that a URL is safe to fetch:
 * - Must be HTTP(S)
 * - Resolve DNS ourselves and validate NO private IPs are returned
 * - Returns the validated URL + the first resolved IP for direct connection
 *
 * For IP-literal hostnames, no DNS is performed (no TOCTOU risk).
 * For hostnames, DNS is resolved here and the first public IP is returned
 * so the caller can connect directly to that IP (preventing DNS rebinding).
 */
async function validateImageUrl(rawUrl: string): Promise<{ url: URL; ip: string } | null> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null
  }

  const hostname = parsedUrl.hostname

  // If hostname is an IP literal, validate directly (no DNS → no TOCTOU)
  if (net.isIPv4(hostname) || net.isIPv6(hostname)) {
    if (isPrivateHost(hostname)) return null
    return { url: parsedUrl, ip: hostname }
  }

  // For hostnames, resolve DNS ourselves and validate
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    for (const addr of addresses) {
      if (isPrivateHost(addr.address)) {
        return null
      }
    }
    // Return the first resolved IP so the caller can connect directly
    return { url: parsedUrl, ip: addresses[0].address }
  } catch {
    return null
  }
}

/**
 * Resolve a redirect Location header relative to the original URL.
 * Returns null if the Location is missing or invalid.
 */
function resolveRedirect(location: string | null, original: URL): URL | null {
  if (!location) return null
  try {
    const resolved = new URL(location, original.origin)
    return resolved
  } catch {
    return null
  }
}

/**
 * Fetch a URL by connecting DIRECTLY to a pre-resolved IP address.
 * This prevents DNS rebinding TOCTOU attacks: the DNS was already
 * resolved and validated, and we bind to that specific IP so no
 * second resolution can occur.
 *
 * For HTTPS, SNI (servername) is set to the original hostname so
 * SSL certificate verification works correctly.
 */
async function directFetch(
  url: URL,
  ip: string,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const isHttps = url.protocol === 'https:'
    const port = parseInt(url.port, 10) || (isHttps ? 443 : 80)
    const path = url.pathname + url.search

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = {
      hostname: ip,
      port,
      path,
      method: 'GET',
      headers: { Host: url.hostname },
      signal,
    }
    // For HTTPS, set servername for SNI so SSL cert is checked against hostname, not IP
    if (isHttps) {
      options.servername = url.hostname
      options.rejectUnauthorized = true
    }

    const lib = isHttps ? https : http
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        const response = new Response(body, {
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
        })
        // Copy response headers
        if (res.headers) {
          for (const [key, values] of Object.entries(res.headers)) {
            if (values !== undefined) {
              const val = Array.isArray(values) ? values.join(', ') : values
              if (val !== undefined) {
                try { response.headers.set(key, val) } catch { /* skip invalid */ }
              }
            }
          }
        }
        resolve(response)
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  const validated = await validateImageUrl(url)
  if (!validated) return null
  const { url: validatedUrl, ip } = validated

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    // Use native fetch for IP literals (no DNS re-resolution risk),
    // use directFetch for hostnames (binds to resolved IP to prevent DNS rebinding)
    const isIpLiteral = net.isIPv4(validatedUrl.hostname) || net.isIPv6(validatedUrl.hostname)

    let response: Response
    if (isIpLiteral) {
      response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    } else {
      response = await directFetch(validatedUrl, ip, controller.signal)
    }
    clearTimeout(timeout)

    // Handle redirects — validate the redirect target before following
    const redirectStatus = response.status
    if (redirectStatus >= 300 && redirectStatus < 400) {
      const redirectUrl = resolveRedirect(
        response.headers.get('location'),
        validatedUrl
      )
      if (!redirectUrl) return null

      // Validate the redirect target (protocol + DNS check)
      const validatedRedirect = await validateImageUrl(redirectUrl.href)
      if (!validatedRedirect) return null

      // Re-fetch with direct connection (only follow one level max)
      const redirectController = new AbortController()
      const redirectTimeout = setTimeout(() => redirectController.abort(), 5000)
      try {
        const isRedirectIp = net.isIPv4(validatedRedirect.url.hostname) || net.isIPv6(validatedRedirect.url.hostname)
        let redirectResponse: Response
        if (isRedirectIp) {
          redirectResponse = await fetch(redirectUrl.href, {
            signal: redirectController.signal,
            redirect: 'manual',
          })
        } else {
          redirectResponse = await directFetch(validatedRedirect.url, validatedRedirect.ip, redirectController.signal)
        }
        clearTimeout(redirectTimeout)

        if (!redirectResponse.ok) return null
        return await extractImageData(redirectResponse)
      } finally {
        clearTimeout(redirectTimeout)
      }
    }

    if (!response.ok) return null
    return await extractImageData(response)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function extractImageData(response: Response): Promise<string | null> {
  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return null
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > 1_048_576) {
    return null
  }

  const buffer = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get('content-type') ?? 'image/png'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function processSvgModules(svg: string, shape: ModuleShape): string {
  if (shape === 'square') return svg

  if (shape === 'rounded') {
    return svg.replace(/<rect([^>]*)>/g, (match, attrs) => {
      if (match.includes('rx=')) return match
      return `<rect${attrs} rx="3" ry="3">`
    })
  }

  if (shape === 'dots') {
    return svg.replace(/<rect([^>]*)>/g, (_match, attrs) => {
      const widthMatch = /width="([^"]+)"/.exec(attrs)
      const heightMatch = /height="([^"]+)"/.exec(attrs)
      const xMatch = /x="([^"]+)"/.exec(attrs)
      const yMatch = /y="([^"]+)"/.exec(attrs)

      if (!widthMatch || !heightMatch || !xMatch || !yMatch) return _match

      const w = parseFloat(widthMatch[1])
      const h = parseFloat(heightMatch[1])
      const cx = parseFloat(xMatch[1]) + w / 2
      const cy = parseFloat(yMatch[1]) + h / 2
      const r = Math.min(w, h) / 2

      return `<circle cx="${cx}" cy="${cy}" r="${r}" />`
    })
  }

  return svg
}

function applyColors(svg: string, fgColor: string, bgColor: string): string {
  let result = svg

  if (bgColor && bgColor !== '#FFFFFF') {
    const rectMatch = /<rect[^>]*fill="#ffffff"[^>]*\/>|<rect[^>]*\/>/
    result = result.replace(rectMatch, (match) => {
      if (match.includes('fill=')) {
        return match.replace(/fill="#[^"]*"/, `fill="${bgColor}"`)
      }
      return match.replace('<rect', `<rect fill="${bgColor}"`)
    })
  }

  result = result.replace(/fill="#[^"]*"/g, (match) => {
    if (match.toLowerCase() === `fill="${bgColor.toLowerCase()}"`) return match
    if (match.toLowerCase() === '"#ffffff"' || match.toLowerCase() === '"#fff"') return match
    return `fill="${fgColor}"`
  })

  return result
}

function addLogoToSvg(svg: string, logoBase64: string): string {
  const viewBoxMatch = /viewBox="([^"]+)"/.exec(svg)
  if (!viewBoxMatch) return svg

  const viewBox = viewBoxMatch[1]
  const parts = viewBox.split(/\s+/).map(Number)
  const width = parts[2]
  const height = parts[3]

  const logoSize = Math.min(width, height) * 0.22
  const logoX = (width - logoSize) / 2
  const logoY = (height - logoSize) / 2

  const logoRect = `<rect x="${logoX - 4}" y="${logoY - 4}" width="${logoSize + 8}" height="${logoSize + 8}" rx="4" fill="#FFFFFF" />`
  const logoImage = `<image href="${logoBase64}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`

  const closingTagIndex = svg.lastIndexOf('</svg>')
  return svg.slice(0, closingTagIndex) + logoRect + logoImage + svg.slice(closingTagIndex)
}

/**
 * Allowed frame type values — must match the SVG filenames in public/qr-frames/.
 * Defense-in-depth: even though the Zod schema now restricts frameType,
 * this allowlist prevents path traversal if generateQRSvg is called from
 * untrusted contexts (e.g., API route or future bulk generation).
 */
const ALLOWED_FRAME_TYPES = new Set([
  '1', '2', '3', '4', '5', '6',
  'bold', 'dashed', 'elegant', 'minimal', 'neon', 'rounded',
])

export function loadFrameSvg(frameType: string): string | null {
  // Block path traversal: only allow known frame types
  if (!ALLOWED_FRAME_TYPES.has(frameType)) {
    return null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    const framePath = path.join(process.cwd(), 'public', 'qr-frames', `frame-${frameType}.svg`)
    if (fs.existsSync(framePath)) {
      return fs.readFileSync(framePath, 'utf-8')
    }
    return null
  } catch {
    return null
  }
}

function addFrameToSvg(svg: string, frameSvg: string, frameLabel?: string): string {
  const viewBoxMatch = /viewBox="([^"]+)"/.exec(svg)
  if (!viewBoxMatch) return svg

  const vbox = viewBoxMatch[1]
  const parts = vbox.split(/\s+/).map(Number)
  const svgWidth = parts[2]
  const svgHeight = parts[3]

  const frameScale = 1.15
  const offsetX = (svgWidth * frameScale - svgWidth) / 2
  const offsetY = (svgHeight * frameScale - svgHeight) / 2

  let frameContent = frameSvg
    .replace(/width="[^"]*"/, `width="${svgWidth}"`)
    .replace(/height="[^"]*"/, `height="${svgHeight}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="0 0 ${svgWidth} ${svgHeight}"`)

  if (frameLabel) {
    const escaped = frameLabel.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
    const labelSvg = `<text x="${svgWidth / 2}" y="${svgHeight + 16}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#666">${escaped}</text>`
    frameContent = frameContent.replace('</svg>', labelSvg + '</svg>')
  }

  const combinedViewBox = `0 0 ${svgWidth} ${svgHeight + (frameLabel ? 28 : 0)}`
  const qrGroup = `<g transform="translate(${offsetX}, ${offsetY}) scale(${1 / frameScale})">${svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))}</g>`

  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="${combinedViewBox}" width="${svgWidth}" height="${svgHeight + (frameLabel ? 28 : 0)}">${frameContent.replace(/<svg[^>]*>/, '').replace('</svg>', '')}${qrGroup}</svg>`
}

export async function generateQRSvg(data: string, options: QRDesignOptions): Promise<string> {
  const svg = await QRCode.toString(data, {
    type: 'svg',
    margin: 2,
    color: {
      dark: options.fgColor,
      light: options.bgColor,
    },
  })

  let processedSvg = processSvgModules(svg, options.moduleShape)

  processedSvg = applyColors(processedSvg, options.fgColor, options.bgColor)

  if (options.logoUrl) {
    const logoBase64 = await fetchImageAsBase64(options.logoUrl)
    if (logoBase64) {
      processedSvg = addLogoToSvg(processedSvg, logoBase64)
    }
  }

  if (options.frameType) {
    const frameSvg = loadFrameSvg(options.frameType)
    if (frameSvg) {
      processedSvg = addFrameToSvg(processedSvg, frameSvg, options.frameLabel)
    }
  }

  return processedSvg
}

export async function generateQrPngBuffer(data: string, options: QRDesignOptions, size: number): Promise<Buffer> {
  const svg = await generateQRSvg(data, options)
  const sharp = await getSharp()
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer()
  return buffer
}

export async function generateQrPdfBuffer(data: string, options: QRDesignOptions): Promise<Buffer> {
  const jspdfModule = await import('jspdf')
  const JsPDF = jspdfModule.default as unknown as new (opts: Record<string, string>) => {
    internal: { pageSize: { getWidth: () => number } }
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => void
    output: (type: string) => ArrayBuffer
  }
  const svg = await generateQRSvg(data, options)

  const sharp = await getSharp()
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(400, 400)
    .png()
    .toBuffer()

  const base64 = pngBuffer.toString('base64')

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const qrSize = 80
  const x = (pageWidth - qrSize) / 2
  const y = 100

  doc.addImage(base64, 'PNG', x, y, qrSize, qrSize)

  const output = doc.output('arraybuffer') as ArrayBuffer
  return Buffer.from(output)
}
