import QRCode from 'qrcode'

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

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
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

function loadFrameSvg(frameType: string): string | null {
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
    try {
      const logoBase64 = await fetchImageAsBase64(options.logoUrl)
      processedSvg = addLogoToSvg(processedSvg, logoBase64)
    } catch {
      // Silently ignore logo loading failures
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
