export function parseDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const lower = ua.toLowerCase()
  if (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(lower)) {
    return 'tablet'
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(lower)) {
    return 'mobile'
  }
  return 'desktop'
}

export function parseOs(ua: string): string {
  const lower = ua.toLowerCase()
  if (/windows/i.test(lower)) return 'Windows'
  if (/mac os|macintosh/i.test(lower)) return 'macOS'
  if (/linux/i.test(lower) && !/android/i.test(lower)) return 'Linux'
  if (/android/i.test(lower)) return 'Android'
  if (/iphone|ipad|ipod/i.test(lower)) return 'iOS'
  if (/chrome os|cros/i.test(lower)) return 'Chrome OS'
  return 'Autre'
}

export function parseBrowser(ua: string): string {
  const lower = ua.toLowerCase()
  if (/edg[e]?\//i.test(lower)) return 'Edge'
  if (/opr\//i.test(lower) || /opera/i.test(lower)) return 'Opera'
  if (/chrome\/(?!.*edg|.*opr)/i.test(lower)) return 'Chrome'
  if (/firefox\//i.test(lower)) return 'Firefox'
  if (/safari\/(?!.*chrome)/i.test(lower)) return 'Safari'
  if (/trident|msie/i.test(lower)) return 'Internet Explorer'
  return 'Autre'
}
