# Sprint 2b — Correctifs Sécurité Résiduels

> **Contexte :** Après le Sprint 1 (7 correctifs critiques) et le Sprint 1b (NV1-NV9), il reste 7 points de sécurité issus de l'audit multi-agents. Ce document détaille chaque point avec analyse, implémentation, code et tests.

---

## Table des matières

1. [Open Redirect via destinationUrl](#1-open-redirect-via-destinationurl)
2. [Protection CSRF sur tRPC](#2-protection-csrf-sur-trpc)
3. [Rotation de Session sur Changement de Rôle/Plan](#3-rotation-de-session-sur-changement-de-rôleplan)
4. [Brute-Force sur les Clés API](#4-brute-force-sur-les-clés-api)
5. [Versioning de l'API](#5-versioning-de-lapi)
6. [Attaque Temporelle (Timing Attack)](#6-attaque-temporelle-timing-attack)
7. [Récapitulatif des Modifications](#7-récapitulatif-des-modifications)

---

## 1. Open Redirect via destinationUrl

### 🔴 Critique — Priorité #1

#### Contexte

Actuellement, `resolveDestination()` dans `redirect.service.ts` retourne la `destinationUrl` stockée dans les métadonnées sans aucune validation de domaine :

```typescript
// src/server/services/redirect.service.ts — ligne 21
case 'URL':
  return destinationUrl ?? '/'
```

Un utilisateur malveillant peut créer un QR code de type `URL` avec `destinationUrl = "https://evil.com/phish"`. Le redirect envoie alors l'utilisateur vers un site externe, permettant :

- **Phishing** : rediriger vers un clone de la page de login
- **Open redirect** : utilisé comme proxy par des attaquants tiers pour blanchir des liens malveillants
- **Trust bypass** : les utilisateurs voient `qrstudio.app` dans la barre d'adresse puis sont redirigés

#### Flux d'attaque

```
1. Attaquant crée QR code avec destinationUrl = "https://evil.com"
2. Victime scanne le QR code
3. /api/qr/abc123 → resolveDestination() retourne "https://evil.com"
4. NextResponse.redirect("https://evil.com") → victime redirigée
5. evil.com affiche un clone de la page de login
```

#### Analyse de Risque

| Critère | Évaluation |
|---------|------------|
| Probabilité | Élevée — n'importe quel utilisateur peut créer un QR code URL |
| Impact | Élevé — phishing, ingénierie sociale, atteinte à la réputation |
| Détection | Facile — lien visible dans les logs mais pas pour l'utilisateur final |
| **Priorité** | **Critique — à corriger immédiatement** |

#### Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/server/services/redirect.service.ts` | Ajouter validation URL : allowlist de domaines ou vérification d'origine |
| `src/lib/validations.ts` | Optionnel : renforcer `urlSchema` côté Zod |
| `src/app/l/[shortCode]/page.tsx` | Ajouter `rel="noopener noreferrer"` et validation du `ctaUrl` |
| `tests/unit/services/redirect.service.test.ts` | Ajouter tests open redirect |

#### Étapes d'Implémentation

##### Étape 1 — Créer une fonction utilitaire `isSafeRedirectUrl`

Cette fonction vérifie qu'une URL de destination est sécurisée :

```typescript
// src/lib/url-security.ts
import { URL } from 'url'

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
const INTERNAL_HOSTS = new Set<string>([
  'localhost',
  'qrstudio.app',
  'www.qrstudio.app',
  process.env.VERCEL_URL ?? '',
].filter(Boolean))

/**
 * Vérifie si une URL de destination est sécurisée pour la redirection.
 *
 * Règles :
 * 1. Les URLs relatives sont toujours autorisées
 * 2. Les URLs absolues vers un sous-domaine de l'application sont autorisées
 * 3. Les URLs absolues vers un domaine de la ALLOWED_EXTERNAL_HOSTS sont autorisées
 * 4. Les URLs absolues vers tout autre domaine sont BLOQUÉES
 * 5. Les protocoles non-HTTP(S) sont bloqués (file://, ftp://, etc.)
 */
export function isSafeRedirectUrl(destination: string): boolean {
  // URL relative → toujours sûre
  if (destination.startsWith('/')) return true

  let parsed: URL
  try {
    parsed = new URL(destination)
  } catch {
    // URL invalide → considérée comme relative, rediriger vers /
    return false
  }

  // Protocole non HTTP(S) → bloqué
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
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
```

##### Étape 2 — Modifier `resolveDestination`

```typescript
// src/server/services/redirect.service.ts
import { isSafeRedirectUrl } from '@/lib/url-security'

export function resolveDestination(qrCode: QRCodeRecord): string {
  if (qrCode.deletedAt) {
    return '/qr-deleted'
  }

  const metadata = (qrCode.metadata as Record<string, unknown>) ?? {}
  const destinationUrl = (metadata.destinationUrl as string | undefined) ?? null

  switch (qrCode.type) {
    case 'URL':
      // [SÉCURITÉ] Valider la destination avant redirection
      if (destinationUrl && isSafeRedirectUrl(destinationUrl)) {
        return destinationUrl
      }
      // Fallback : rediriger vers une page d'information sécurisée
      return destinationUrl ? '/redirect-blocked' : '/'
    case 'WHATSAPP': {
      const phone = destinationUrl ?? ''
      const cleaned = phone.replace(/[^0-9]/g, '')
      // wa.me est un domaine connu et autorisé
      return `https://wa.me/${cleaned}`
    }
    case 'WIFI':
      return `/wifi/${qrCode.shortCode}`
    case 'LANDING_PAGE':
      return `/l/${qrCode.shortCode}`
    case 'VCARD':
    case 'PDF':
    case 'TEXT':
      return `/view/${qrCode.shortCode}`
  }
}
```

##### Étape 3 — Créer la page `/redirect-blocked`

```tsx
// src/app/redirect-blocked/page.tsx
import Link from 'next/link'

export default function RedirectBlockedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">
          ⚠️ Redirection bloquée
        </h1>
        <p className="text-muted-foreground mb-6">
          Ce QR code tente de rediriger vers un site externe non autorisé.
          Par sécurité, la redirection a été bloquée.
        </p>
        <Link
          href="/"
          className="text-primary hover:underline"
        >
          Retour à l'accueil
        </Link>
      </div>
    </main>
  )
}
```

##### Étape 4 — Renforcer la validation Zod côté création

```typescript
// src/lib/validations.ts
import { z } from 'zod'

// Nouveau schéma : URL avec validation de sécurité
export const safeUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url)
      // Bloquer les protocoles non-HTTP(S)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false
      }
      return true
    } catch {
      return false
    }
  },
  { message: "Seules les URLs HTTP(S) sont autorisées" }
)

// Ancien urlSchema conservé pour compatibilité
export const urlSchema = z.string().url()
```

##### Étape 5 — Sécuriser les landing pages

```tsx
// src/app/l/[shortCode]/page.tsx
// Dans le composant, ligne ~95 :
<a
  href={lp.ctaUrl}
  target="_blank"
  rel="noopener noreferrer" // ← AJOUTER
  className="..."
>
  {lp.ctaLabel || "En savoir plus"}
</a>
```

#### Tests

```typescript
// tests/unit/lib/url-security.test.ts
import { describe, it, expect } from 'vitest'
import { isSafeRedirectUrl } from '@/lib/url-security'

describe('isSafeRedirectUrl', () => {
  it('should allow relative URLs', () => {
    expect(isSafeRedirectUrl('/')).toBe(true)
    expect(isSafeRedirectUrl('/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('/l/abc123')).toBe(true)
  })

  it('should allow internal application URLs', () => {
    expect(isSafeRedirectUrl('https://qrstudio.app/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('https://www.qrstudio.app/')).toBe(true)
    expect(isSafeRedirectUrl('http://localhost:3000/test')).toBe(true)
  })

  it('should block external URLs by default', () => {
    expect(isSafeRedirectUrl('https://evil.com/phish')).toBe(false)
    expect(isSafeRedirectUrl('https://malware.net')).toBe(false)
    expect(isSafeRedirectUrl('http://192.168.1.1/admin')).toBe(false)
  })

  it('should block non-HTTP protocols', () => {
    expect(isSafeRedirectUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeRedirectUrl('ftp://evil.com/file')).toBe(false)
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false)
  })

  it('should handle invalid URLs gracefully', () => {
    expect(isSafeRedirectUrl('not-a-url')).toBe(false)
    expect(isSafeRedirectUrl('')).toBe(false)
  })
})
```

```typescript
// tests/unit/services/redirect.service.test.ts — AJOUTER
describe('resolveDestination — open redirect protection', () => {
  it('should block external destination URLs', () => {
    const result = resolveDestination({
      shortCode: 'abc123',
      type: 'URL',
      status: 'ACTIVE',
      metadata: { destinationUrl: 'https://evil.com/phish' },
      deletedAt: null,
    })
    expect(result).toBe('/redirect-blocked')
  })

  it('should allow internal destination URLs', () => {
    const result = resolveDestination({
      shortCode: 'abc123',
      type: 'URL',
      status: 'ACTIVE',
      metadata: { destinationUrl: 'https://qrstudio.app/page' },
      deletedAt: null,
    })
    expect(result).toBe('https://qrstudio.app/page')
  })

  it('should redirect to / when destinationUrl is null', () => {
    const result = resolveDestination({
      shortCode: 'abc123',
      type: 'URL',
      status: 'ACTIVE',
      metadata: {},
      deletedAt: null,
    })
    expect(result).toBe('/')
  })
})
```

#### Critères d'Acceptation

- [ ] `resolveDestination()` ne redirige jamais vers un domaine externe non autorisé
- [ ] Les URLs relatives continuent de fonctionner
- [ ] WhatsApp (`wa.me`) est autorisé car c'est un domaine fixe et contrôlé
- [ ] Landing pages `ctaUrl` a `rel="noopener noreferrer"`
- [ ] Une page `/redirect-blocked` existe pour les redirections bloquées
- [ ] `npm run test` passe (nouveaux tests inclus)
- [ ] `npm run typecheck` passe

#### Estimation : **S** (1-2 jours)

---

## 2. Protection CSRF sur tRPC

### 🔴 Critique — Priorité #2

#### Contexte

tRPC utilise `fetchRequestHandler` pour gérer les requêtes HTTP. Actuellement, **aucune protection CSRF** n'est implémentée : pas de vérification d'origine, pas de token CSRF, pas de double-submit cookie.

```typescript
// src/app/api/trpc/[trpc]/route.ts — lignes 1-13
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext as never,
  })

export { handler as GET, handler as POST }
```

Les mutations tRPC (POST) sont vulnérables : un site malveillant peut soumettre un formulaire qui POST vers `/api/trpc` avec les cookies de session de la victime (automatiquement envoyés par le navigateur) et exécuter une action non désirée.

#### Flux d'attaque

```
1. Victime connectée à qrstudio.app visite evil.com
2. evil.com a un iframe caché ou un formulaire auto-submit
3. POST vers https://qrstudio.app/api/trpc + cookies session
4. tRPC exécute la mutation (ex: deleteWorkspace, revokeApiKey)
5. Victime ne voit rien — l'attaque est invisible
```

#### Analyse de Risque

| Critère | Évaluation |
|---------|------------|
| Probabilité | Élevée — CSRF classique sur API sans token |
| Impact | Élevé — suppression de données, modification de configuration |
| Détection | Difficile — l'attaque ne laisse pas de trace côté serveur |
| **Priorité** | **Critique — à corriger en priorité** |

#### Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/server/trpc.ts` | Ajouter un middleware CSRF |
| `src/app/api/trpc/[trpc]/route.ts` | Ajouter une vérification d'en-tête `x-csrf-token` |
| `src/components/shared/trpc-provider.tsx` | Ajouter l'en-tête CSRF aux requêtes |
| `src/middleware.ts` | Optionnel : ajouter une vérification Origin au niveau middleware |

#### Étapes d'Implémentation

##### Étape 1 — Ajouter un en-tête CSRF personnalisé côté client

Le principe : le client Next.js (front-end) envoie un en-tête personnalisé `x-csrf-token: 1` avec chaque requête tRPC. Le serveur vérifie la présence de cet en-tête pour les mutations POST.

```typescript
// src/components/shared/trpc-provider.tsx
"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { useState } from "react"
import superjson from "superjson"
import { api } from "@/lib/trpc/client"

function getBaseUrl() {
  if (typeof window !== "undefined") return ""
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            // [SÉCURITÉ] En-tête CSRF obligatoire pour les mutations
            // Vérifié côté serveur par le middleware csrf()
            return {
              "x-csrf-token": "1",
            }
          },
        }),
      ],
    })
  )

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </api.Provider>
  )
}
```

##### Étape 2 — Ajouter le middleware CSRF côté serveur

```typescript
// src/server/trpc.ts — AJOUTER après la ligne 50

/**
 * Middleware CSRF : protège les mutations contre les attaques CSRF.
 *
 * Principe : vérifie que les requêtes POST (mutations) contiennent
 * l'en-tête `x-csrf-token: 1`. Les requêtes GET (queries) sont
 * autorisées sans en-tête (lecture seule, pas de CSRF possible).
 *
 * Les requêtes provenant de l'API externe (clés API) utilisent
 * un en-tête `x-api-key` et n'ont pas besoin de CSRF.
 */
const csrfMiddleware = t.middleware(({ ctx, next, rawInput, type }) => {
  // Les queries GET sont en lecture seule — pas de risque CSRF
  if (type === 'query') {
    return next({ ctx })
  }

  // Les mutations et subscriptions nécessitent un token CSRF
  // On accède aux en-têtes via le contexte (les adapters fetch
  // mettent les headers à disposition)
  const reqHeaders = (ctx as Record<string, unknown>).reqHeaders as Record<string, string> | undefined
  const csrfToken = reqHeaders?.['x-csrf-token']

  if (csrfToken !== '1') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Token CSRF manquant ou invalide',
    })
  }

  return next({ ctx })
})

// Appliquer le middleware CSRF à toutes les procédures protégées
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed).use(csrfMiddleware)
```

##### Étape 3 — Passer les en-têtes HTTP dans le contexte tRPC

```typescript
// src/server/trpc.ts — MODIFIER createTRPCContext

import type { PrismaClient } from "@prisma/client"

export interface TRPCContext {
  db: PrismaClient
  session: unknown
  user?: {
    id: string
    email: string
    name: string | null
    image: string | null
    plan: string
  }
  workspace?: {
    id: string
    slug: string
    role: string
  }
  reqHeaders?: Record<string, string>  // ← AJOUTÉ
}

export async function createTRPCContext(opts?: { headers: Headers }): Promise<TRPCContext> {  // ← MODIFIÉ
  const session = await auth()

  const headers: Record<string, string> = {}
  if (opts?.headers) {
    opts.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
  }

  return {
    db: prisma,
    session,
    user: session?.user
      ? {
          id: session.user.id as string,
          email: session.user.email as string,
          name: (session.user.name as string) ?? null,
          image: (session.user.image as string) ?? null,
          plan: (session.user.plan as string) ?? "FREE",
        }
      : undefined,
    reqHeaders: headers,  // ← AJOUTÉ
  }
}
```

##### Étape 4 — Mettre à jour le handler tRPC

```typescript
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/server/routers/_app"
import { createTRPCContext } from "@/server/trpc"

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }) as never,  // ← MODIFIÉ
  })

export { handler as GET, handler as POST }
```

##### Étape 5 (Optionnel) — Ajouter une vérification Origin dans le middleware

```typescript
// src/middleware.ts — AJOUTER dans la section tRPC

// [SÉCURITÉ] Vérification CSRF au niveau middleware pour les mutations tRPC
if (url.startsWith("/api/trpc/") && request.method === "POST") {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // Vérification d'origine : le header Origin doit correspondre à notre domaine
  if (origin) {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "https://qrstudio.app",
      "https://www.qrstudio.app",
    ].filter(Boolean)

    const isAllowed = allowedOrigins.some(
      (allowed) => allowed && origin.startsWith(allowed)
    )

    if (!isAllowed) {
      const resp = new NextResponse(
        JSON.stringify({ error: "CSRF: Origin non autorisé" }),
        { status: 403 }
      )
      return resp
    }
  }
}
```

#### Tests

```typescript
// tests/unit/trpc-csrf.test.ts
import { describe, it, expect } from 'vitest'

// Test du middleware CSRF en isolation
describe('csrfMiddleware', () => {
  it('devrait rejeter les mutations sans token CSRF', async () => {
    // Simuler une mutation sans en-tête CSRF
    // Vérifier que TRPCError est lancé avec code BAD_REQUEST
  })

  it('devrait autoriser les mutations avec token CSRF valide', async () => {
    // Simuler une mutation avec x-csrf-token: 1
    // Vérifier que le middleware passe
  })

  it('devrait autoriser les queries sans token CSRF', async () => {
    // Simuler une query (GET) — pas de vérification CSRF
    // Vérifier que le middleware passe
  })
})
```

#### Critères d'Acceptation

- [ ] Les mutations tRPC sans `x-csrf-token: 1` sont rejetées
- [ ] Les queries tRPC sans `x-csrf-token: 1` sont autorisées (GET, lecture seule)
- [ ] Le client tRPC envoie automatiquement l'en-tête CSRF
- [ ] Les appels API externes (avec `x-api-key`) ne nécessitent pas de CSRF
- [ ] `npm run test` passe
- [ ] `npm run typecheck` passe

#### Estimation : **M** (2-3 jours)

---

## 3. Rotation de Session sur Changement de Rôle/Plan

### 🟡 Moyen — Priorité #3

#### Contexte

Quand le plan d'un utilisateur change (via webhook Stripe), la base de données est mise à jour mais le JWT de l'utilisateur conserve l'ancienne valeur jusqu'à ce que la session expire ou que `updateAge` (6h) déclenche un rafraîchissement.

```typescript
// src/server/auth.ts — lignes 77-83
async jwt({ token, user }) {
  if (user) {
    token.id = user.id as string
    token.plan = (user as { plan?: string }).plan ?? "FREE"
  }
  return token
},
```

#### Flux d'attaque

```
1. Utilisateur souscrit au plan FREE
2. Webhook Stripe reçu : plan → PRO, DB mise à jour
3. L'utilisateur peut utiliser les fonctionnalités PRO via l'API (DB check)
4. Mais son JWT dit encore FREE jusqu'à dans 6h max
5. Certains composants front-end lisent le plan depuis le JWT (session.user.plan)
6. → Incohérence entre UI et fonctionnalités réelles
```

#### Analyse de Risque

| Critère | Évaluation |
|---------|------------|
| Probabilité | Faible — l'utilisateur est légitime, le problème est l'UX |
| Impact | Moyen — incohérence UI, délai d'accès aux fonctionnalités |
| Détection | Automatique — l'utilisateur voit une UI FREE mais a accès PRO |
| **Priorité** | **Moyenne — améliore l'expérience et la sécurité** |

#### Solution : Vérification DB dans le callback JWT

Plutôt que de faire confiance à la valeur en cache dans le JWT, on vérifie le plan actuel dans la base de données à chaque appel du callback `jwt`. Cela garantit que la session reflète toujours l'état réel.

**⚠️ Attention :** NextAuth appelle `jwt()` à chaque requête protégée. Une requête DB par requête peut impacter les performances. Solution : utiliser le `updateAge` comme cache court (5 min au lieu de 6h) plutôt qu'une requête DB systématique.

#### Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/server/auth.ts` | Ajouter vérification DB dans le callback `jwt` |
| `src/lib/constants.ts` | Optionnel : ajouter le délai de rafraîchissement |

#### Étapes d'Implémentation

##### Étape 1 — Modifier le callback JWT pour vérifier le plan en DB

```typescript
// src/server/auth.ts — MODIFIER le callback jwt
callbacks: {
  async jwt({ token, user, trigger }) {
    // [SÉCURITÉ] Rafraîchir les données utilisateur depuis la DB
    // pour garantir que le JWT reflète l'état actuel.
    // Utilisé notamment après les changements de plan via Stripe.
    if (token.id) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { plan: true, email: true },
        })

        if (!dbUser) {
          // Utilisateur supprimé → invalider le token
          return {}
        }

        // Mettre à jour le plan depuis la DB
        token.plan = dbUser.plan
        token.email = dbUser.email
      } catch {
        // Erreur DB — conserver les valeurs existantes du token
        // pour ne pas casser la session en cas de panne transitoire
        if (user) {
          token.id = user.id as string
          token.plan = (user as { plan?: string }).plan ?? "FREE"
        }
      }
    } else if (user) {
      // Premier sign-in
      token.id = user.id as string
      token.plan = (user as { plan?: string }).plan ?? "FREE"
    }

    return token
  },

  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string
      session.user.plan = (token.plan as string) ?? "FREE"
    }
    return session
  },
},
```

##### Étape 2 — Ajuster le updateAge

```typescript
// src/server/auth.ts — MODIFIER session config
session: {
  strategy: "jwt",
  maxAge: 24 * 60 * 60,     // 24h — durée de vie max du JWT
  updateAge: 5 * 60,         // 5 min — rafraîchit le JWT toutes les 5 min
  // Note : chaque rafraîchissement déclenche jwt() qui vérifie la DB
  // pour le plan actuel.
},
```

##### Étape 3 — Invalider les sessions lors du changement de plan côté webhook

```typescript
// src/server/services/billing.service.ts — AJOUTER
// Les changements de plan via les webhooks Stripe doivent être
// rapidement reflétés dans les sessions.

// Dans handleWebhookEvent, après chaque mise à jour du plan :
// Le callback jwt() vérifie maintenant le plan en DB à chaque appel.
// Avec updateAge à 5 minutes, le délai max est de 5 min.
// Aucune invalidation manuelle de session nécessaire.
```

#### Tests

```typescript
// tests/unit/auth/jwt-refresh.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('JWT callback — plan refresh from DB', () => {
  it('devrait mettre à jour le plan depuis la DB si token.id existe', async () => {
    // Simuler un utilisateur avec plan PRO en DB
    // Vérifier que le token reçoit "PRO" même si le user passé est "FREE"
  })

  it('devrait invalider le token si l\'utilisateur n\'existe plus en DB', async () => {
    // Simuler un utilisateur supprimé
    // Vérifier que le callback retourne {} (token invalide)
  })

  it('devrait fallback sur les valeurs user lors d\'une erreur DB', async () => {
    // Simuler une erreur DB
    // Vérifier que le token conserve les valeurs du paramètre user
  })

  it('devrait set les valeurs initiales depuis user au premier sign-in', async () => {
    // Simuler user présent mais pas token.id
    // Vérifier que token.id et token.plan sont définis depuis user
  })
})
```

#### Critères d'Acceptation

- [ ] Le JWT reflète le plan actuel de l'utilisateur en DB
- [ ] Délai max entre changement de plan et mise à jour JWT < 5 min (`updateAge`)
- [ ] En cas d'erreur DB, le JWT conserve l'ancienne valeur (dégradation gracieuse)
- [ ] Utilisateur supprimé → JWT invalidé (session terminée)
- [ ] `npm run test` passe
- [ ] `npm run typecheck` passe

#### Estimation : **S** (1 jour)

---

## 4. Brute-Force sur les Clés API

### 🟡 Moyen — Priorité #4

#### Contexte

La méthode `apiKeyService.validate()` est appelée à chaque requête API externe. Actuellement :
- **Pas de rate limiting** sur la validation des clés API
- **Hash SHA-256 rapide** (pas de bcrypt/argon2)
- **Pas de détection** de tentatives échouées

```typescript
// src/server/services/api-key.service.ts — lignes 82-110
async validate(key: string) {
  const keyHash = crypto.createHash("sha256").update(key).digest("hex")
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } })
  // ...
}
```

Une clé API a le format `qrs_` + 64 caractères hexadécimaux = 256 bits d'entropie. La probabilité de deviner une clé est négligeable, mais **l'absence de rate limiting permet un brute-force ciblé** si un attaquant a obtenu un extrait de clé.

#### Analyse de Risque

| Critère | Évaluation |
|---------|------------|
| Probabilité | Très faible — 256 bits d'entropie, infaisable en pratique |
| Impact | Élevé — une clé API compromise donne accès complet à l'API |
| Détection | Difficile sans logs spécifiques |
| **Priorité** | **Moyenne — défense en profondeur** |

#### Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `prisma/schema.prisma` | Ajouter champ `failedAttempts` et `lockedUntil` à ApiKey |
| `src/server/services/api-key.service.ts` | Ajouter rate limiting et lockout |
| `src/lib/rate-limit.ts` | Optionnel : ajouter rate limiter API key |
| `tests/unit/services/api-key.service.test.ts` | Ajouter tests |

#### Étapes d'Implémentation

##### Étape 1 — Mettre à jour le schéma Prisma

```prisma
// prisma/schema.prisma — MODIFIER le modèle ApiKey
model ApiKey {
  id             String    @id @default(cuid())
  userId         String
  name           String
  keyHash        String    @unique
  keyPrefix      String
  lastUsedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  failedAttempts Int       @default(0)        // ← AJOUTÉ
  lockedUntil    DateTime?                     // ← AJOUTÉ

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

##### Étape 2 — Ajouter le rate limiting dans `validate()`

```typescript
// src/server/services/api-key.service.ts — MODIFIER validate

async validate(key: string) {
  const keyHash = crypto.createHash("sha256").update(key).digest("hex")

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      userId: true,
      revokedAt: true,
      id: true,
      lockedUntil: true,     // ← AJOUTÉ
      failedAttempts: true,   // ← AJOUTÉ
    },
  })

  if (!apiKey) {
    // Clé inconnue — ne pas révéler si la clé existe ou non
    // (timing attack mitigée par le hash lookup unique)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Clé API invalide",
    })
  }

  // [SÉCURITÉ] Vérifier le lockout
  if (apiKey.lockedUntil && apiKey.lockedUntil > new Date()) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Clé API temporairement verrouillée après trop de tentatives",
    })
  }

  if (apiKey.revokedAt) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Clé API révoquée",
    })
  }

  // Succès — réinitialiser les tentatives échouées
  if (apiKey.failedAttempts > 0) {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { failedAttempts: 0, lockedUntil: null },
    })
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return { userId: apiKey.userId }
},

// Nouvelle méthode : enregistrer une tentative échouée
async recordFailedAttempt(keyHash: string): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, failedAttempts: true },
  })

  if (!apiKey) return // Clé inconnue — ignorer

  const newAttempts = apiKey.failedAttempts + 1
  const LOCKOUT_THRESHOLD = 10  // 10 échecs consécutifs
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000  // 15 minutes

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      failedAttempts: newAttempts,
      lockedUntil: newAttempts >= LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : undefined,
    },
  })
},
```

##### Étape 3 — Ajouter rate limiting IP sur la route API key

```typescript
// Si les clés API sont validées via un futur endpoint REST,
// ajouter dans src/middleware.ts ou dans le handler :

// Exemple pour un handler REST API key :
const API_KEY_RATE_LIMIT = 20  // Tentatives par fenêtre

// Vérifier dans le handler de validation :
// 1. Rate limit IP
// 2. Rate limit par keyHash (si connu)
// 3. Lockout si trop d'échecs
```

#### Tests

```typescript
// tests/unit/services/api-key.service.test.ts — AJOUTER
describe('apiKeyService.validate — rate limiting', () => {
  it('devrait verrouiller la clé après 10 échecs consécutifs', async () => {
    // Simuler 10 appels validate avec une clé incorrecte pour le même keyHash
    // Vérifier que lockedUntil est défini
  })

  it('devrait rejeter les appels pendant le lockout', async () => {
    // Simuler lockedUntil dans le futur
    // Vérifier que TOO_MANY_REQUESTS est lancé
  })

  it('devrait réinitialiser les tentatives après un succès', async () => {
    // Simuler failedAttempts=5, puis appel validate réussi
    // Vérifier que failedAttempts=0 et lockedUntil=null
  })
})
```

#### Critères d'Acceptation

- [ ] Une clé API est verrouillée après 10 échecs consécutifs
- [ ] Pendant le lockout (15min), toutes les requêtes sont rejetées avec `TOO_MANY_REQUESTS`
- [ ] Une validation réussie réinitialise le compteur d'échecs
- [ ] `npm run test` passe
- [ ] `npm run typecheck` passe

#### Estimation : **S** (1-2 jours)

---

## 5. Versioning de l'API

### 🟢 Faible — Priorité #5

#### Contexte

Toutes les routes API sont actuellement non-versionnées :

```
/api/trpc/          → tRPC (toutes les procédures)
/api/qr/[shortCode] → Redirection QR
/api/auth/          → NextAuth
/api/webhooks/      → Stripe
/api/uploadthing/   → Upload
/api/health/        → Health check
```

L'absence de versioning rend difficile :
- L'évolution de l'API sans casser les clients existants
- La dépréciation progressive des anciennes versions
- La compatibilité avec les clés API externes

#### Analyse de Risque

| Critère | Évaluation |
|---------|------------|
| Probabilité | N/A — pas un risque de sécurité direct |
| Impact | Faible — problème d'évolutivité, pas de brèche |
| **Priorité** | **Faible — à traiter lors de la prochaine évolution majeure** |

#### Fichiers à Modifier

| Fichier | Action |
|---------|--------|
| `src/app/api/trpc/[trpc]/route.ts` | Ajouter support du préfixe `/v1/` |
| `src/middleware.ts` | Mettre à jour les chemins pour inclure `/v1/` |
| `src/components/shared/trpc-provider.tsx` | Mettre à jour l'URL du client |
| `src/app/api/qr/[shortCode]/route.ts` | Ajouter route versionnée (ou redirect) |

#### Approche Recommandée

**Ne pas réécrire toutes les routes maintenant.** Approche minimaliste :

1. **tRPC** : Ajouter un alias `/api/v1/trpc` → `/api/trpc`
2. **Documenter** le schéma de versioning dans le README
3. **Planifier** l'ajout du préfixe `v1` pour la prochaine version majeure

##### Implémentation minimale

```typescript
// next.config.ts — AJOUTER un redirect pour /api/v1/trpc → /api/trpc
// ou utiliser le middleware
```

```typescript
// src/middleware.ts — AJOUTER
// Rediriger /api/v1/* vers /api/* pour compatibilité
if (url.startsWith("/api/v1/")) {
  const newUrl = url.replace("/api/v1/", "/api/")
  const requestUrl = new URL(newUrl, request.url)
  return NextResponse.rewrite(requestUrl)
}
```

```typescript
// src/middleware.ts — AJOUTER aux matchers
export const config = {
  matcher: [
    "/api/:path*",        // ← CHANGÉ de /api/qr/ et /api/trpc/ spécifiques
    "/dashboard",
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
}
```

⚠️ **Attention** : élargir le matcher à `/api/:path*` intercepte TOUTES les routes API (y compris webhooks). Vérifier que les webhooks Stripe ne sont pas impactés (ils retournent 200/400/500 — pas de redirect, pas de blocage).

#### Critères d'Acceptation

- [ ] `/api/v1/trpc` fonctionne (rewrite vers `/api/trpc`)
- [ ] Les routes existantes continuent de fonctionner
- [ ] La documentation mentionne la version de l'API
- [ ] Aucune régression sur les webhooks Stripe

#### Estimation : **XS** (quelques heures)

---

## 6. Attaque Temporelle (Timing Attack)

### 🟢 Faible — Priorité #6

#### Contexte

Analyse des comparaisons potentiellement vulnérables aux timing attacks :

| Emplacement | Méthode | Risque |
|------------|---------|--------|
| `auth.ts:48` — `bcrypt.compare(pwd, hash)` | Constant-time | ✅ **Sûr** |
| `auth.service.ts:157` — `bcrypt.compare(pwd, hash)` | Constant-time | ✅ **Sûr** |
| `api-key.service.ts:83-85` — SHA-256 + `findUnique` | Hash lookup | ⚠️ **Faible** |
| `auth.ts:29` — `prisma.user.findUnique({ where: { email } })` | DB lookup | ⚠️ **Faible** |

#### Analyse Détaillée

##### bcrypt.compare() — ✅ SÛR

`bcrypt.compare()` est conçu pour être constant-time et inclut un coût de calcul délibéré (~100ms). Aucun risque de timing attack exploitable.

##### SHA-256 + findUnique — ⚠️ FAIBLE

Le hash SHA-256 de la clé API est calculé puis utilisé dans un `findUnique` avec index unique. Les risques :
- Le temps de hachage SHA-256 est constant pour une entrée donnée (pas de variation)
- La recherche par index unique est O(log n) — pas de variation significative entre trouvé/non trouvé
- L'attaquant ne connaît pas le hash (doit d'abord brute-forcer la clé)
- **Risque négligeable en pratique**

##### findUnique par email — ⚠️ FAIBLE

```typescript
const user = await prisma.user.findUnique({ where: { email }, select: {...} })
```

- Cette requête s'exécute **avant** `bcrypt.compare()`
- Un attaquant peut mesurer le temps entre "email existe" (bcrypt ~100ms) et "email n'existe pas" (retour immédiat)
- **Mitigation partielle** : `recordFailedAttempt()` est appelée dans les deux cas (échec email + échec mot de passe) → le lockout est le même → l'attaquant ne peut pas distinguer rapidement
- **Risque résiduel** : la différence de ~100ms de bcrypt est mesurable avec suffisamment d'échantillons

#### Actions Recommandées

##### Action 1 — Ajouter un délai artificiel pour les emails inexistants

```typescript
// src/server/auth.ts — MODIFIER authorize()
if (!user || !user.passwordHash) {
  // Anti-timing : ajouter un délai artificiel pour masquer
  // la différence entre email existant (bcrypt ~100ms) et
  // email inexistant (return immédiat).
  await authService.recordFailedAttempt(email)

  // Délai artificiel pour équilibrer le temps de réponse
  await sleep(100) // 100ms ≈ temps d'un bcrypt.compare()

  return null
}
```

```typescript
// src/lib/utils.ts — AJOUTER
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

##### Action 2 — Documenter les choix

```typescript
// src/server/services/api-key.service.ts
// [SÉCURITÉ] Choix délibéré : SHA-256 au lieu de bcrypt pour le hash
// des clés API car :
// 1. Les clés API ont 256 bits d'entropie — infaisable à brute-forcer
// 2. La validation est appelée à chaque requête API (haute fréquence)
// 3. bcrypt ajouterait ~100ms de latence à chaque appel API
// 4. Le rate limiting (10 échecs → lockout 15min) compense le hash rapide
```

#### Critères d'Acceptation

- [ ] Délai artificiel de 100ms pour les emails inexistants (auth)
- [ ] Documentation des choix de sécurité pour les clés API
- [ ] `npm run test` passe
- [ ] `npm run typecheck` passe

#### Estimation : **XS** (quelques heures)

---

## 7. Récapitulatif des Modifications

### Arbre des fichiers modifiés

```
src/
├── app/
│   ├── api/
│   │   ├── qr/[shortCode]/route.ts         → [1] Pas de modification (déjà safe via redirect.service.ts)
│   │   └── trpc/[trpc]/route.ts             → [2] Contexte avec headers
│   ├── l/[shortCode]/page.tsx               → [1] rel="noopener noreferrer"
│   └── redirect-blocked/
│       └── page.tsx                         → [1] NOUVEAU
├── components/
│   └── shared/
│       └── trpc-provider.tsx                → [2] headers() avec CSRF token
├── lib/
│   ├── url-security.ts                      → [1] NOUVEAU
│   ├── utils.ts                             → [6] sleep()
│   └── validations.ts                       → [1] safeUrlSchema
├── server/
│   ├── auth.ts                              → [3] JWT callback DB check + updateAge 5min
│   ├── trpc.ts                              → [2] csrfMiddleware + reqHeaders contexte
│   └── services/
│       ├── redirect.service.ts              → [1] isSafeRedirectUrl check
│       ├── api-key.service.ts               → [4] Rate limiting + lockout
│       └── billing.service.ts               → [3] Commentaire (déjà géré par JWT callback)
├── middleware.ts                            → [5] Support /api/v1/ + optimisation matcher
prisma/
└── schema.prisma                            → [4] failedAttempts + lockedUntil
tests/
└── unit/
    ├── lib/
    │   └── url-security.test.ts             → [1] NOUVEAU
    ├── services/
    │   ├── redirect.service.test.ts         → [1] Tests open redirect
    │   └── api-key.service.test.ts          → [4] Tests lockout
    └── auth/
        └── jwt-refresh.test.ts              → [3] NOUVEAU
```

### Priorités et Planning

| # | Tâche | Priorité | Effort | Dépendances |
|---|-------|----------|--------|-------------|
| 1 | Open Redirect | 🔴 Critique | 1-2j | Aucune |
| 2 | CSRF tRPC | 🔴 Critique | 2-3j | Aucune |
| 3 | Rotation Session | 🟡 Moyenne | 1j | Aucune |
| 4 | API Key Brute-force | 🟡 Moyenne | 1-2j | Migration Prisma |
| 5 | Versioning API | 🟢 Faible | 0.5j | Aucune |
| 6 | Timing Attack | 🟢 Faible | 0.5j | Aucune |

**Total estimé : 6-10 jours**

### Recommandation d'ordre d'exécution

1. **Sprint 2b.1** (semaine 1) : Open redirect + CSRF tRPC — les deux critiques
2. **Sprint 2b.2** (semaine 2) : Session rotation + API key brute-force
3. **Sprint 2b.3** (semaine 3) : Versioning API + Timing attack (quick wins)

---

*Document généré le 2026-06-08 — Basé sur l'audit de sécurité multi-agents et l'analyse du codebase.*
