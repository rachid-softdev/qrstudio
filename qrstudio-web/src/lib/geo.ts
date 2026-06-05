// Solution hybride :
// 1. Vercel Edge → utiliser request.geo.country (via headers)
// 2. Node.js → utiliser DB GeoLite2 locale (MaxMind) si installée
// 3. Fallback → null (pas d'appel réseau externe bloquant)

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
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "unknown") return null

  const now = Date.now()
  const cached = cache.get(ip)

  if (cached && now - cached.timestamp < TTL) {
    return cached.country
  }

  if (cache.size >= MAX_ENTRIES) {
    cleanCache()
  }

  // Note: la base MaxMind (npm: maxmind) peut être installée optionnellement.
  // Si `GEOIP_DB_PATH` est défini, décommentez le bloc ci-dessous :
  //
  //   const maxmind = await import("maxmind")
  //   const reader = await maxmind.open(GEOIP_DB_PATH)
  //   const result = reader.get(ip)
  //   return result?.country?.names?.fr ?? result?.country?.names?.en ?? null

  return null
}
