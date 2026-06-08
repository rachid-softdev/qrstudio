/**
 * Domaines autorisés pour les redirections externes.
 * Les redirections vers des domaines externes non autorisés sont bloquées.
 */
const ALLOWED_EXTERNAL_HOSTS = new Set<string>([
  // Ajouter ici les domaines externes autorisés (ex: wa.me pour WhatsApp)
])

/**
 * Domaines internes de l'application — toujours autorisés.
 */
const INTERNAL_HOSTS = new Set<string>(
  [
    "localhost",
    "qrstudio.app",
    "www.qrstudio.app",
    process.env.VERCEL_URL ?? "",
  ].filter(Boolean)
)

/**
 * Vérifie si une URL de destination est sécurisée pour la redirection.
 *
 * Règles :
 * 1. Les URLs relatives sont toujours autorisées (sauf `//evil.com`)
 * 2. Les URLs absolues vers un sous-domaine de l'application sont autorisées
 * 3. Les URLs absolues vers un domaine de ALLOWED_EXTERNAL_HOSTS sont autorisées
 * 4. Les URLs absolues vers tout autre domaine sont BLOQUÉES
 * 5. Les protocoles non-HTTP(S) sont bloqués (file://, ftp://, etc.)
 * 6. Les URLs protocol-relative (//evil.com) sont bloquées
 */
export function isSafeRedirectUrl(destination: string): boolean {
  // URL relative → toujours sûre (sauf protocol-relative //evil.com)
  if (destination.startsWith("/") && !destination.startsWith("//")) return true

  let parsed: URL
  try {
    parsed = new URL(destination)
  } catch {
    // URL invalide → considérée comme non-sûre
    return false
  }

  // Protocole non HTTP(S) → bloqué
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false
  }

  // Domaine interne → autorisé
  if (INTERNAL_HOSTS.has(parsed.hostname)) return true

  // Sous-domaine de l'application → autorisé
  for (const host of INTERNAL_HOSTS) {
    if (host && parsed.hostname.endsWith(`.${host}`)) return true
  }

  // Domaine externe autorisé → autorisé
  if (ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)) return true

  // Tout autre domaine → BLOQUÉ
  return false
}
