type CacheEntry = {
  country: string
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const TTL = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 10_000

function cleanCache(): void {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > TTL) {
      cache.delete(key)
    }
  }
}

export async function getCountry(ip: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(ip)

  if (cached && now - cached.timestamp < TTL) {
    return cached.country
  }

  if (cache.size >= MAX_ENTRIES) {
    cleanCache()
  }

  try {
    const response = await fetch(`https://ip-api.com/json/${ip}`, {
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as { country?: string; status?: string }

    if (data.status !== 'success' || !data.country) {
      return null
    }

    cache.set(ip, { country: data.country, timestamp: now })
    return data.country
  } catch {
    return null
  }
}
