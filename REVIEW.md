# 📋 Revue de Code — QrStudio

> **Date :** 9 juin 2026
> **Projet :** QR Studio — SaaS de génération et gestion de QR codes dynamiques
> **Version :** v0.1.0
> **Mode :** Revue complète multi-agents (17 spécialistes)

---

## 📍 ÉTAPE 0 — Cartographie du Codebase

### Arborescence des modules clés

```
qrstudio-web/                              # Monorepo applicatif
├── src/                                    # ~12 375 LOC, 158 fichiers
│   ├── app/                                # Next.js 15 App Router
│   │   ├── (auth)/                         # Pages auth group
│   │   │   ├── login/                     # Connexion (credentials + Google)
│   │   │   ├── register/                  # Inscription
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/                    # Pages dashboard group
│   │   │   ├── billing/                   # Abonnement Stripe
│   │   │   ├── qr-codes/                  # Liste QR codes (+ client component)
│   │   │   ├── qr/
│   │   │   │   ├── new/                   # Création QR code (stepper)
│   │   │   │   └── [id]/                  # Détail + édition
│   │   │   ├── settings/                  # Profil + sécurité
│   │   │   ├── team/                      # Gestion équipe
│   │   │   ├── layout.tsx                 # Dashboard layout (sidebar + header)
│   │   │   ├── page.tsx                   # Dashboard principal + stats
│   │   │   └── dashboard-stats-client.tsx
│   │   ├── api/                            # API routes Next.js
│   │   │   ├── auth/[...nextauth]/        # NextAuth handler
│   │   │   ├── health/                    # Health check
│   │   │   ├── qr/[shortCode]/            # Redirect public
│   │   │   ├── trpc/[trpc]/               # tRPC HTTP handler
│   │   │   ├── uploadthing/               # File upload
│   │   │   └── webhooks/stripe/           # Stripe webhook
│   │   ├── auth/totp/                      # TOTP verification MFA
│   │   ├── invite/[token]/                 # Invitation équipe
│   │   ├── l/[shortCode]/                  # Landing page / redirect
│   │   ├── qr-not-found/                   # 404 QR code
│   │   ├── qr-paused/                      # QR code en pause
│   │   ├── qr-deleted/                     # QR code supprimé
│   │   ├── redirect-blocked/              # Redirection bloquée
│   │   ├── layout.tsx                      # Root layout (TRPCProvider, Sentry, Toaster)
│   │   ├── page.tsx                        # Landing page publique
│   │   ├── not-found.tsx                   # 404
│   │   ├── error.tsx                       # Error boundary
│   │   ├── global-error.tsx               # Erreur fatale
│   │   └── globals.css                     # Styles globaux + design tokens
│   │
│   ├── components/                         # Composants React
│   │   ├── billing/                       # plan-card, usage-meter, cancel-subscription
│   │   ├── layout/                        # sidebar, header, logo
│   │   ├── qr/                            # 14 composants (card, editor, creator/* avec 17 fichiers)
│   │   ├── settings/                      # profile-form, security-form, api-key, danger-zone
│   │   ├── shared/                        # empty-state, loading-skeleton, confirm-dialog, page-header
│   │   ├── team/                          # member-list, invite-form, pending-invitations
│   │   └── ui/                            # 16 composants shadcn/ui (button, input, card, dialog, etc.)
│   │
│   ├── hooks/                              # 2 hooks
│   │   ├── use-qr-list.ts                 # Gestion liste QR (filtres + pagination)
│   │   └── use-analytics.ts               # Données analytics
│   │
│   ├── lib/                                # Utilitaires (13 fichiers)
│   │   ├── constants.ts                   # PLAN_LIMITS, QR_TYPES_SCHEMA, etc.
│   │   ├── utils.ts                       # cn(), formatDate(), generateShortCode()
│   │   ├── validations.ts                 # Zod schemas (QRCreate, QRUpdate, etc.)
│   │   ├── qr-generator.ts                # Génération SVG/PNG/PDF
│   │   ├── qr-utils.ts                    # Utilitaires QR
│   │   ├── geo.ts                         # IP géolocalisation (ip-api.com)
│   │   ├── rate-limit.ts                  # Upstash Redis rate limiting
│   │   ├── retry.ts                       # Retry with exponential backoff + jitter
│   │   ├── url-security.ts               # Validation/sanitization URLs
│   │   ├── user-agent.ts                 # Parse Device/OS/Browser
│   │   ├── logger.ts                      # Pino logger
│   │   ├── uploadthing.ts                 # Upload config
│   │   └── trpc/                          # Client/Server tRPC helpers
│   │
│   ├── server/                             # Backend complet
│   │   ├── auth.ts                        # NextAuth v5 config (Credentials + Google + TOTP)
│   │   ├── db.ts                          # PrismaClient singleton
│   │   ├── db-edge.ts                     # Prisma Accelerate client (Edge Runtime)
│   │   ├── trpc.ts                        # tRPC init, context, middleware, auth
│   │   ├── queue.ts                       # PgBoss queue manager
│   │   ├── cache/                         # Analytics cache (in-memory + TTL)
│   │   ├── routers/                       # 6 routers tRPC
│   │   │   ├── _app.ts                    # Root router merger
│   │   │   ├── auth.ts                    # Auth procedures
│   │   │   ├── qr.ts                      # CRUD QR + analytics + export
│   │   │   ├── team.ts                    # Workspace team management
│   │   │   ├── billing.ts                 # Stripe subscriptions
│   │   │   └── apiKey.ts                  # API keys management
│   │   ├── services/                      # 11 services métier
│   │   │   ├── auth.service.ts            # Auth logic (login, register, lockout)
│   │   │   ├── qr.service.ts              # QR CRUD + plan limits + short code
│   │   │   ├── team.service.ts            # Invitation, roles
│   │   │   ├── billing.service.ts         # Stripe checkout, webhook, subscriptions
│   │   │   ├── analytics.service.ts       # Analytics + aggregation + CSV export
│   │   │   ├── api-key.service.ts         # API key management
│   │   │   ├── redirect.service.ts        # URL redirect logic
│   │   │   ├── email.service.ts           # Transactional emails (Resend)
│   │   │   ├── totp.service.ts            # TOTP/MFA management
│   │   │   ├── aggregation.service.ts     # ScanDaily aggregation orchestration
│   │   │   └── stripe-idempotency.ts      # Stripe idempotency helpers
│   │   └── workers/                       # 4 PgBoss workers
│   │       ├── scan-recorder.ts           # Async scan recording (queue consumer)
│   │       ├── aggregation.worker.ts      # ScanDaily aggregation (runs every 60s)
│   │       ├── cleanup-trash.worker.ts    # Soft-deleted QR cleanup
│   │       └── retention-cleanup.worker.ts # Data retention enforcement
│   │
│   ├── middleware.ts                      # Rate limiting + auth redirect
│   └── types/                             # Types partagés
│       ├── index.ts                      # Plan, Role, QRType, etc.
│       └── next-auth.d.ts                # NextAuth type augmentation
│
├── prisma/
│   ├── schema.prisma                      # 11 modèles, 4 enums
│   └── migrations/                        # 7 migrations (cascade, scan_daily, etc.)
│
├── tests/                                 # ~5 899 LOC, 34 fichiers
│   ├── unit/                              # Tests unitaires (lib/ + services/)
│   ├── integration/                       # Tests d'intégration (routers + services)
│   └── e2e/                               # Tests E2E Playwright (3 specs)
│
├── scripts/
│   └── backfill-scan-daily.ts             # Backfill script for ScanDaily
│
├── instrumentation.ts                     # Sentry instrumentation
├── instrumentation-client.ts              # Client-side Sentry
├── next.config.ts                         # CSP, headers, Sentry, images
├── tailwind.config.ts                     # Design tokens CSS variables
├── vitest.config.ts
├── playwright.config.ts
├── components.json                        # shadcn/ui config (base-nova)
├── tsconfig.json                          # TypeScript strict
├── eslint.config.mjs
├── postcss.config.mjs
└── .env.example

.opencode/                                 # OpenCode configuration
├── opencode.json
└── package.json
```

### Stack technique détectée

| Technologie | Version | Usage |
|------------|---------|-------|
| **Next.js** | 15.5.19 | App Router, RSC, Server Actions |
| **TypeScript** | 5.x (strict) | Langage principal — `noUncheckedIndexedAccess` activé |
| **React** | 19.2.7 | UI Library |
| **tRPC** | 11.13.0 | API typée (client ↔ serveur) |
| **Prisma** | 5.22.0 | ORM + Migrations (driverAdapters) |
| **PostgreSQL** | — | Base de données (via Prisma Accelerate) |
| **NextAuth.js** | 5.0.0-beta.31 | Auth (Credentials, Google, JWT, TOTP) |
| **Tailwind CSS** | 3.4.19 | Styling utilitaire |
| **shadcn/ui** | Base Nova | Design system (`@base-ui/react`) |
| **Zod** | 3.25.76 | Validation schémas |
| **Stripe** | 22.2.0 | Paiement / Abonnements |
| **Sentry** | 10.56.0 | Monitoring erreurs + performance |
| **Recharts** | 3.8.1 | Graphiques analytics |
| **React Hook Form** | 7.77.0 | Gestion formulaires |
| **Sonner** | 2.0.7 | Toasts |
| **Uploadthing** | 7.7.4 | Upload fichiers |
| **Resend** | 6.12.4 | Emails transactionnels |
| **Lucide React** | 1.17.0 | Icônes |
| **jspdf** | 4.2.1 | Export PDF |
| **qrcode** | 1.5.4 | Génération QR code |
| **sharp** | — | Traitement images (serveur) |
| **bcryptjs** | 3.0.3 | Hash passwords |
| **jsonwebtoken** | 9.0.3 | JWT tokens |
| **Pino** | 10.3.1 | Logger structuré |
| **PgBoss** | 12.18.2 | Queue / Job scheduler |
| **Upstash Redis + Ratelimit** | — | Rate limiting distribué |
| **otplib** | 13.4.1 | TOTP/MFA |
| **Vitest** | 4.1.8 | Tests unitaires + intégration |
| **Playwright** | 1.60.0 | Tests E2E |
| **jsdom** | 29.1.1 | Test DOM |

### Points d'entrée principaux

| Point d'entrée | Fichier | Rôle |
|---|---|---|
| **Root Layout** | `src/app/layout.tsx` | TRPCProvider, Sentry, Toaster, polices |
| **Dashboard Layout** | `src/app/(dashboard)/layout.tsx` | Sidebar + Header + Auth guard |
| **Middleware** | `src/middleware.ts` | Rate limiting + Auth redirect + URL rewrite |
| **tRPC Handler** | `src/app/api/trpc/[trpc]/route.ts` | API Gateway |
| **tRPC Router** | `src/server/routers/_app.ts` | Merge 5 sous-routers |
| **NextAuth** | `src/server/auth.ts` | Auth config (Credentials, Google, TOTP) |
| **Stripe Webhook** | `src/app/api/webhooks/stripe/route.ts` | Payment events |
| **QR Redirect** | `src/app/api/qr/[shortCode]/route.ts` | Public redirect |
| **QR Landing** | `src/app/l/[shortCode]/page.tsx` | Landing page render |
| **Health Check** | `src/app/api/health/route.ts` | Health endpoint |
| **Invite Accept** | `src/app/invite/[token]/page.tsx` | Team invitation |

### Volume estimé

| Métrique | Valeur |
|----------|--------|
| Fichiers source (src/) | 158 fichiers |
| Lignes de code (src/) | ~12 375 LOC |
| Fichiers Prisma (schéma + migrations) | ~554 LOC |
| Fichiers de test | 34 fichiers |
| Lignes de test | ~5 899 LOC |
| Composants UI (shadcn) | 16 composants |
| Composants feature (qr/, billing/, etc.) | ~40 composants |
| Services métier | 11 services |
| Routers tRPC | 6 routers (dont _app.ts) |
| Hooks React | 2 hooks |
| Workers PgBoss | 4 workers |
| Modèles Prisma | 11 modèles |
| Enums Prisma | 4 enums |
| Migrations Prisma | 7 migrations |

### Dépendances externes principales

**Production (38 dépendances)** : @base-ui/react, @hookform/resolvers, @prisma/client, @prisma/extension-accelerate, @sentry/nextjs, @tanstack/react-query, @trpc/client, @trpc/next, @trpc/react-query, @trpc/server, @uploadthing/react, @upstash/ratelimit, @upstash/redis, autoprefixer, bcryptjs, class-variance-authority, clsx, jsonwebtoken, jspdf, lucide-react, next, next-auth, next-themes, otplib, pg-boss, pino, postcss, prisma, qrcode, react, react-dom, react-hook-form, recharts, resend, shadcn, sonner, stripe, superjson, tailwind-merge, tw-animate-css, uploadthing, zod

**Développement (10 dépendances)** : ESLint, Playwright, Vitest, @types, jsdom, tailwindcss, etc.

### Découpage en couches identifié

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION (UI)                          │
│  app/ (pages RSC + Client Components)                        │
│  components/ (feature components + ui/ shadcn)               │
│  hooks/ (useAnalytics, useQRList)                            │
├─────────────────────────────────────────────────────────────┤
│              APPLICATION / API (tRPC)                        │
│  middleware.ts (rate limit + auth + request ID)              │
│  server/routers/ (5 routers : auth, qr, team, billing, api) │
│  server/trpc.ts (context, middleware, auth guards)           │
├─────────────────────────────────────────────────────────────┤
│                    MÉTIER (Services)                          │
│  server/services/ (11 services : auth, qr, analytics, ...)   │
│  lib/validations.ts (Zod schemas métier)                     │
│  lib/constants.ts (PLAN_LIMITS, business rules)              │
│  server/workers/ (4 PgBoss workers async)                    │
├─────────────────────────────────────────────────────────────┤
│                  DATA ACCESS (Persistence)                    │
│  server/db.ts (PrismaClient singleton)                       │
│  server/db-edge.ts (Prisma Accelerate edge client)           │
│  prisma/schema.prisma (11 modèles ORM)                       │
│  server/cache/ (analytics-cache.ts)                          │
├─────────────────────────────────────────────────────────────┤
│                 INFRASTRUCTURE (External)                     │
│  Sentry (monitoring + tracing)                               │
│  Upstash Redis (rate limiting distribué)                     │
│  Uploadthing (file storage)                                  │
│  Stripe (paiement)                                           │
│  Resend (email transactionnel)                               │
│  PgBoss (queue PostgreSQL)                                   │
│  Prisma Accelerate (Edge DB proxy)                           │
│  next.config.ts (CSP, HSTS, headers)                         │
└─────────────────────────────────────────────────────────────┘
```

### Architecture des données (schéma relationnel)

```
User ──1:N──> Account (OAuth)
User ──1:N──> Session
User ──1:N──> WorkspaceMember
User ──1:N──> Workspace (as owner)
User ──1:N──> ApiKey
User ────1:1──> StripeCustomer (via fields sur User)

Workspace ──1:N──> QRCode
Workspace ──1:N──> WorkspaceMember
Workspace ──1:N──> WorkspaceInvitation

QRCode ──1:N──> Scan
QRCode ──1:N──> ScanDaily (pre-aggregated)
QRCode ──1:1──> LandingPage (onDelete: SetNull)

ScanDaily ──N:1──> QRCode (date-partitioned aggregates)

WebhookEvent (idempotency tracking)

AggregationWatermark (worker checkpoint)
```

### Modèles de données (Prisma — 11 modèles)

| Modèle | Rôle | Particularités |
|--------|------|----------------|
| `User` | Compte utilisateur | plan, stripeCustomerId, stripeSubscriptionId, totp*, loginAttempts, lockoutUntil |
| `Account` | OAuth accounts (NextAuth) | Cascade delete |
| `Session` | Sessions (NextAuth) | Cascade delete |
| `VerificationToken` | Email verification | Composite unique |
| `Workspace` | Espace de travail | ownerId, slug unique |
| `WorkspaceMember` | Membre workspace | Role OWNER/EDITOR/VIEWER |
| `WorkspaceInvitation` | Invitation | Token unique, expiration |
| `QRCode` | QR code | shortCode (unique), type-dependent metadata (JSONB), design config, soft-delete (deletedAt), onDelete: SetNull pour LandingPage |
| `LandingPage` | Landing page design | bgColor, textColor, cta*, imageUrl |
| `Scan` | Scan individuel | ipHash, deviceType, os, browser, country, city |
| `ScanDaily` | Pre-aggregated analytics | Composite unique (qrCodeId, date), byCountry/Device/Os/Browser (JSONB) |
| `AggregationWatermark` | Worker checkpoint | Queue name unique |
| `ApiKey` | API key | keyHash (unique), keyPrefix, failedAttempts, lockedUntil |
| `WebhookEvent` | Stripe idempotency | event.id as PK |

---

---

## 🖥️ ÉTAPE 1 — Front-End Review (6 agents)

### 🚨 Problèmes critiques

| Agent | Composant/Fichier | Description | Impact | Solution |
|---|---|---|---|---|
| UI/DS | `tailwind.config.ts` + `globals.css` | **Mismatch HSL↔OKLCH** — Tailwind référence `hsl(var(--...))` mais `globals.css` définit les variables en `oklch(...)`. Toutes les couleurs seront interprétées incorrectement. | 🔴 Toutes les couleurs de l'UI sont fausses (thème sombre incohérent) | Homogénéiser : utiliser OKLCH dans les deux ou HSL dans les deux |
| UI | `globals.css` l.82-99 | **Bloc `@layer base` dupliqué** — le second écrase le premier, supprimant `outline-ring/50` | Les focus rings peuvent être perdus | Supprimer un bloc, garder `outline-ring/50` |
| A11Y | `global-error.tsx` l.17 | `<html>` sans attribut `lang="fr"` — les lecteurs d'écran ne détectent pas la langue | WCAG 3.1.1 échoué | Ajouter `lang="fr"` |
| UX | `login-form.tsx` l.69-71 | **"Mot de passe oublié"** est un placeholder non-fonctionnel (toast "Contactez le support V1") | Bloque l'utilisateur sans accès | Implémenter une vraie réinitialisation |
| FE Arch | `trpc-provider.tsx` l.25 | **CSRF token statique** `x-csrf-token: '1'` — valeur fixe, pas de protection réelle | Faux sentiment de sécurité | Token dynamique serveur |
| UX | `qr-code-list-client.tsx` l.108 | **`window.confirm()`** au lieu du composant `<AlertDialog>` | Incohérence UI, thème non respecté | Remplacer par `<AlertDialog>` |
| A11Y | `loading-skeleton.tsx` l.7-17 | Absence d'`aria-hidden`, `role="status"`, `aria-label` | Lecteurs d'écran annoncent le skeleton comme contenu réel | Ajouter attributs d'accessibilité |
| DS | `current-plan-banner.tsx` l.22-25 | Couleurs hardcodées (`bg-emerald-500/10`, `border-primary/20`) hors design tokens | Non adaptable au thème | Utiliser les CSS variables |

### ⚠️ Améliorations importantes

| Agent | Composant/Fichier | Description | Solution |
|---|---|---|---|
| A11Y | `qr-card.tsx` l.65-166 | Éléments interactifs imbriqués (`<Link>` + `<DropdownMenu>`) inaccessibles au clavier | Extraire le dropdown hors du `<Link>` |
| Responsive | `button.tsx` l.23-34 | Tailles de bouton trop petites pour mobile (xs=24px, sm=28px vs WCAG 44×44px) | Ajouter `min-h-[44px]` sur mobile via `@media (pointer: coarse)` |
| FE Arch | `qr-creator/index.tsx` l.65-67 | Payload faiblement typé (`Record<string, unknown>` avec cast) | Définir une interface typée avec Zod |
| FE Arch | `utils.ts` l.32-42 | Biais modulo dans `getRandomInt` (distribution non uniforme) | Utiliser `crypto.randomUUID()` ou rejet |
| UX | `page.tsx` (landing) | Redirection immédiate vers `/login`, pas de landing page | SEO nul, pas de présentation produit |
| UI | `error.tsx` + `global-error.tsx` | Bouton `<button>` natif au lieu du composant `Button` shadcn | Remplacer par `<Button onClick={reset}>` |
| A11Y | `layout.tsx` l.37 | `Sentry.ErrorBoundary` fallback sans `role="alert"` | Ajouter `role="alert"` sur le `<p>` |
| DS | `globals.css` l.24 | `--destructive-foreground` en HSL alors que toutes les autres variables sont en OKLCH | Homogénéiser le format |

### ✨ Détails de finition (polish)

| Description | Fichier | Effort |
|---|---|---|
| `alt` text vide sur avatars si `user.name` est null | `sidebar.tsx:94` | XS |
| QRListFilters utilise même texte "Corbeille" pour les deux états du toggle | `qr-list-filters.tsx:91` | XS |
| Pas de feedback loading pour le bouton "Voir plus" | `qr-code-list-client.tsx:200` | XS |
| Pas de meta viewport/meta charset dans `global-error.tsx` | `global-error.tsx` | S |

### 🎨 Éléments visuellement discutables

1. **Badge "Actif" dans `current-plan-banner.tsx`** utilise `bg-accent` (couleur neutre) → utilisateur peut penser que le plan n'est pas vraiment actif. **Solution** : Utiliser un token `--success` (teinte verte).
2. **Step indicator dans `qr-creator`** — barre de connexion entre les steps de 32px disparaît sur mobile mais l'espacement vertical reste. **Solution** : Version verticale avec barre à droite sur mobile.
3. **Preview panel dans `QRCreator`** toujours affiché même sans type sélectionné. Sur mobile, la grille `lg:grid-cols-2` compresse le stepper inutilement. **Solution** : Afficher le preview en accordéon sur mobile.
4. **Dropdown-menu sur `QRCard`** avec `opacity-0 group-hover:opacity-100` — invisible par défaut, introuvable sur mobile (pas de hover). **Solution** : Toujours afficher avec `opacity-60` et pleine au hover.
5. **Pas de thème "system"** — le dark mode utilise la classe `.dark` mais sans media query `prefers-color-scheme`. **Solution** : Ajouter `@media (prefers-color-scheme: dark) { .dark { ... } }`.

### Score global Front-End

| Catégorie | Note | Justification |
|---|---|---|
| **Design** | 6/10 | Tokens oklch/hsl mismatch casse toutes les couleurs. Composants shadcn bien structurés mais thème incohérent |
| **UX** | 7/10 | Flows globaux clairs. Placeholder "Mot de passe oublié", `window.confirm`, pas de landing page |
| **Responsive** | 8/10 | Bon usage des breakpoints. Points faibles : tailles boutons <44px, dropdown invisible |
| **Accessibilité** | 5/10 | `global-error.tsx` sans `lang`, skeleton sans `aria-hidden`, éléments interactifs imbriqués |
| **Maintenabilité** | 7/10 | Bon découpage composants, hooks propres. Payload faiblement typé |

### Top 10 actions prioritaires Front-End

1. **[XL]** Corriger le mismatch HSL↔OKLCH entre `globals.css` et `tailwind.config.ts`
2. **[M]** Ajouter `lang="fr"` au `<html>` de `global-error.tsx` + `aria-hidden` au `Skeleton`
3. **[M]** Remplacer `window.confirm()` par `<AlertDialog>` dans `qr-code-list-client.tsx`
4. **[S]** Supprimer le bloc dupliqué `@layer base` dans `globals.css`
5. **[M]** Implémenter une vraie page de réinitialisation de mot de passe
6. **[S]** Extraire le `<DropdownMenu>` du `<Link>` dans `QRCard`
7. **[M]** Remplacer les `<button>` natives dans `error.tsx` et `global-error.tsx` par `Button`
8. **[L]** Remplacer les exports faiblement typés dans `qr-creator` par des types stricts
9. **[S]** Ajouter `min-h-[44px]` pour les boutons tactiles sur mobile
10. **[XS]** Fixer le biais modulo dans `getRandomInt` de `utils.ts`

---

## ⚙️ ÉTAPE 2 — Back-End Review (8 agents)

### 🚨 Critiques (corriger immédiatement)

| Agent | Fichier/module | Description | Impact | Risque | Solution |
|---|---|---|---|---|---|
| 3 (Sécu) | `auth.service.ts:342-360` | **`jwt.decode()` au lieu de `jwt.verify()`** — signature JAMAIS vérifiée. Attaquant peut forger un token pour n'importe quel `userId` | 🔴 **Contournement total de l'auth** — compte bypass | Critique — OWASP A1 | Remplacer par `jwt.verify()` avec `NEXTAUTH_SECRET` |
| 3 (Sécu) | `trpc.ts:73-89` | **CSRF token hardcodé à `'1'`** — valeur statique, trivialement falsifiable | 🔴 Protection CSRF absente | Critique — OWASP A1 | Token CSRF par session ou SameSite + Origin |
| 1 (Arch) | `server/db-edge.ts:19` | `as unknown as PrismaClient` — perd tout le typage TypeScript | Toute requête utilisant ce client perd la type safety | Élevé | Définir un type personnalisé |
| 4 (Perf) | `qr-generator.ts:341-360` | `fs.readFileSync` synchrone dans une fonction async tRPC | Bloque l'event loop sur chaque export SVG | Moyen | Cache en mémoire + `fs.promises.readFile` |
| 4 (Perf) | `analytics.service.ts:230-262` | 4 requêtes SQL brutes séparées pour les données analytics partielles du jour | Requêtes coûteuses sur les gros volumes | Élevé | Combiner en une seule requête SQL |
| 7 (Rel) | `middleware.ts:5` + `rate-limit.ts` | Aucun commentaire — rate limiting via Upstash Redis (OK) mais **pas de fallback** si Redis est indisponible | Rate limiting désactivé = risque déni de service | Élevé | Fallback mémoire ou mode dégradé |
| 3/5 (DB) | `analytics.service.ts:97-153` | `recordScan` fait 3 écritures DB synchromes dans une transaction | Latence redirect QR, contention sous charge | Élevé | Rendre asynchrone via PgBoss (déjà partiellement fait avec le worker) |
| 3/5 (DB) | `analytics.service.ts:460-483` | `legacyExportCSV` sans pagination — `take: 10000` fixe | Truncation silencieuse des données | Moyen | Déprécier au profit de `exportCSVPage` |
| 2/4 (Qual) | `qr.ts:44-62` + `qr.service.ts` | Duplication `buildQRData` entre router et service | Maintenance doublée, risque de désynchronisation | Moyen | Supprimer la version router |
| 3 (Sécu) | `stripe/route.ts` + `billing.service.ts` | Webhook Stripe — idempotency OK via WebhookEvent (bien), **pas de rate limiting** sur l'endpoint webhook | Burst d'events Stripe peut saturer la DB | Moyen | Rate limit spécifique webhook + buffer PgBoss |

### ⚠️ Problèmes importants

| Agent | Description | Solution |
|---|---|---|
| 3 (Sécu) | Pas de rate limiting sur TOTP/backup code (endpoints publics) | 5 tentatives/IP/minute |
| 3 (Sécu) | Pas de rate limiting sur `register` (seulement IP-level dans middleware) | Per-email + per-IP |
| 3 (Sécu) | API key validation ne vérifie pas si le plan est toujours payant | Ajouter `user.plan !== 'FREE'` dans `apiKeyService.validate()` |
| 3 (Sécu) | `ALLOWED_EXTERNAL_HOSTS` est vide dans `url-security.ts` | Bloque tous les liens externes légitimes |
| 1 (Arch) | Vérifications de rôle ad-hoc dans les procédures (pas de middleware) | Créer `workspaceProcedure(roles)` middleware |
| 4 (Perf) | Pas de timeout Prisma (commentaire dans `db.ts` le confirme) | Configurer `statement_timeout` PostgreSQL |
| 7 (Obs) | Workers utilisent `console.log` au lieu du logger structuré | Remplacer par `logger` Pino |
| 7 (Obs) | `logger.ts` est un wrapper `console.*` — Pino installé mais jamais utilisé | Utiliser Pino avec sortie JSON |
| 5 (DB) | `moduleShape` est un `String` au lieu d'un ENUM Prisma | Ajouter CHECK constraint ou enum |
| 6 (API) | Export CSV legacy tronque à 10 000 lignes silencieusement | Déprécier, forcer pagination |

### 💡 Opportunités d'amélioration

| Description | Bénéfice | Effort |
|---|---|---|
| Rendre `loadFrameSvg` async + cache | Évite les spikes de latence | S |
| Ajouter `withRetry` + timeout sur Prisma | Évite les requêtes pendantes | M |
| Utiliser Pino avec corrélation ID | Logs exploitables en production | S |
| Rate limiting par utilisateur tRPC | Plus équitable que par IP | M |
| Middleware de vérification de rôle DRY | Sécurité cohérente | S |
| Endpoint `/api/health` | Monitoring, load balancer | S |
| Index composite Scan `(qrCodeId, scannedAt, ipHash)` | Requêtes analytics plus rapides | S |
| Optimiser les 4 requêtes analytics en 1 | Réduit charge DB | M |

### 🔒 Sécurité

| Vulnérabilité | OWASP | Criticité | Solution |
|---|---|---|---|
| `jwt.decode()` au lieu de `verify()` | A1 Broken Access Control | **Critical** | `jwt.verify(partialToken, NEXTAUTH_SECRET)` |
| CSRF statique `'1'` | A1 Broken Access Control | **Critical** | Token par session |
| Pas de rate limit TOTP | A4 Insecure Design | **High** | 5/IP/min |
| `jsonwebtoken` 9.0.3 CVE RCE | A6 Vulnerable Components | **Critical** | Update ≥9.0.4 ou migrer vers `jose` |
| `ALLOWED_EXTERNAL_HOSTS` vide | A1 Injection | **Medium** | Configurer allowlist |
| IP hash SHA-256 déterministe | A4 Data Exposure | **Low** | HMAC avec sel périodique |
| `safeUrlSchema` non utilisé pour `imageUrl` landing page | A1 Injection | **Low** | Utiliser `safeUrlSchema` |
| Env vars avec `!` sans validation | A5 Misconfiguration | **Medium** | Module env.ts avec Zod |

### ⚡ Performance

| Problème | Impact | Solution |
|---|---|---|
| `fs.readFileSync` dans async tRPC | +5-50ms bloquant l'event loop | Cache + `fs.promises` |
| 4 requêtes analytics partielles | Charge DB élevée sur gros volumes | Une seule requête SQL |
| Pas de timeout Prisma | Connexion pendante 75s | `statement_timeout` |
| PgBoss sans reconnection | Jobs perdus silencieusement | Health check + reconnect |
| 2 clients Redis séparés | Connexions gaspillées | Singleton Redis |
| `readWithCache` JSON parse | Overhead inutile | Stocker en format natif |

### 🗄️ Base de données

| Problème | Tables | Solution |
|---|---|---|
| Index composite manquant `(qrCodeId, scannedAt, ipHash)` | `Scan` | Ajouter l'index |
| `moduleShape` String au lieu d'enum | `QRCode` | CHECK constraint ou enum |
| `totpBackupCodes` JSON sans validation | `User` | Table dédiée ou Zod runtime |
| Aucune politique de purge `Scan` | `Scan` | Job cron de rétention |

### 🧱 Architecture

| Problème | Modules | Solution |
|---|---|---|
| Vérifications de rôle ad-hoc | `routers/qr.ts`, `trpc.ts` | Middleware `workspaceProcedure(roles)` |
| CSRF middleware inefficace | `trpc.ts` | Token par session |
| Pas de DI — services importent `prisma` en dur | Tous les services | Rendre `prisma` injectable |
| Singleton queue sans reconnection | `queue.ts` | Health check + reconnect |
| `redirect.service.ts` responsabilités mixtes | `redirect.service.ts` | Séparer résolution URL + règles métier |

### 📈 Scalabilité

| Risque | Seuil | Solution |
|---|---|---|
| 4 requêtes analytics partielles | 100K+ scans/jour | Pré-agréger plus fréquemment |
| Cleanup workers séquentiels par plan | 100K+ QR codes supprimés | Paralléliser par plan |
| Détection uniqueScans avec `findFirst` sous contention | 1000+ scans/s concurrents | Redis HyperLogLog |
| Légacy export CSV 10K lignes | 50K+ scans | Forcer pagination |
| PgBoss même connexion DB que l'app | 100+ jobs concurrents | Pool de connexions dédié |

### 🧪 Tests manquants

| Zone non couverte | Type de test | Priorité |
|---|---|---|
| Tous les services (auth, qr, analytics, team, billing, api-key) | Unitaires (Prisma mocké) | **Haute** |
| Tous les routers tRPC | Intégration (DB test) | **Haute** |
| Middleware CSRF | Unitaires | **Haute** |
| Rate limiting | Intégration (Redis mock) | **Moyenne** |
| Génération QR (SVG, PNG, PDF) | Unitaires (test vectors) | **Moyenne** |
| URL Security (SSRF, open redirect) | Unitaires (edge cases) | **Haute** |
| Retry utility | Unitaires | **Moyenne** |
| Workers (aggregation, cleanup, retention) | Intégration (DB test) | **Moyenne** |
| Flux d'auth (register, login, lockout, TOTP, backup codes) | E2E / Intégration | **Haute** |

### 📋 Dette technique identifiée

| Description | Coût ignoré | Effort |
|---|---|---|
| `jwt.decode()` — auth bypass prêt à être exploité | Catastrophique (takeover total) | 1h |
| `totpBackupCodes` JSON sans type safety | Moyen (corruption à la réactivation TOTP) | 4h |
| Duplication VCard/WiFi formatting | Faible (risque d'incohérence) | 1h |
| Edge Prisma type cast (`as unknown`) | Moyen (runtime errors) | 3h |
| `console.log` dans workers | Faible (logs inexploitables) | 1h |
| Logger wrapper drop info/debug en prod | Moyen (aveugle en production) | 2h |
| `exportCsv` legacy 10K limite non documentée | Faible (perte de données silencieuse) | 1h |

### Score global Back-End

| Domaine | Note | Justification |
|---|---|---|
| **Architecture** | 7/10 | Bonne séparation couches, mais checks rôles ad-hoc et DI manquante |
| **Sécurité** | 5/10 | **Critique** : auth bypass (`jwt.decode`), CSRF cassé, pas de rate limit TOTP, CVE jsonwebtoken |
| **Performance** | 7/10 | Bonne stratégie cache, mais sync I/O, timeouts manquants, analytics partiels |
| **Maintenabilité** | 8/10 | Modules bien structurés, nomenclature cohérente. Duplication VCard/WiFi |
| **Scalabilité** | 6/10 | Analytics partiel et détection uniqueScans deviendront goulots |
| **Observabilité** | 4/10 | Logger console, pas de sortie structurée, pas de health endpoint |

### Top 10 actions prioritaires Back-End

1. **[S] [Critical]** — Fixer `jwt.decode()` → `jwt.verify()` dans `auth.service.ts:345`
2. **[M] [Critical]** — Fixer CSRF token `'1'` → token par session
3. **[S] [High]** — Ajouter rate limiting sur TOTP/backup code
4. **[M] [High]** — Ajouter Prisma query timeouts (`statement_timeout`)
5. **[S] [High]** — Cache SVGs frames en mémoire (remplacer `readFileSync`)
6. **[M] [High]** — Ajouter tests pour tous les services (commencer par auth.service + qr.service)
7. **[M] [Medium]** — Remplacer `console.log` dans workers par logger structuré
8. **[L] [Medium]** — Optimiser les 4 requêtes analytics en une seule
9. **[S] [Medium]** — Ajouter middleware de vérification de rôle
10. **[M] [Medium]** — Duplication `buildQRData` — supprimer la version router

---

## 🏢 ÉTAPE 3 — Business Layer Review (3 agents)

### Agent 1 — Business Analyst

| Problème | Impact business | Cas concret qui échouerait | Suggestion |
|---|---|---|---|
| **VIEWER peut créer des QR codes** (pas de vérification rôle dans `qr.create`) | VIEWER peut polluer le workspace | Un VIEWER invité crée 50 QR codes, ne peut ni les modifier ni les supprimer | Ajouter `if (role === 'VIEWER') throw FORBIDDEN` |
| **Pas de règle de déclassement (downgrade)** | Utilisateur PRO→FREE bloqué sans message clair | PRO avec 50 codes passe FREE → ne peut plus rien créer | Message d'erreur avec explication + solution |
| **Bulk generation non implémenté** (`PLAN_LIMITS.bulkGeneration = true` mais pas d'API) | Fonctionnalité vendue mais injoignable | Client PRO clique "Génération en masse" → 404 | Implémenter ou retirer du plan |
| **Pas de validation `apiAccess` dans les routes API REST** | FREE peut appeler API sans restriction | Appel API non-tRPC non protégé | Middleware centralisé |
| **Vérification limite dupliquée** dans `qr.create` (router + service) | Un COUNT DB inutile sur chaque création | - | Supprimer du router |
| **Logique d'enregistrement scan dupliquée** (Edge + Server) | Maintenance doublée, divergence possible | Bug fixé dans un chemin pas dans l'autre | Factoriser fonction partagée |
| **Race condition dans `restore()`** — pas de transaction | Dépassement des limites plan | 2 restaurations simultanées → 101 QR codes actifs | `$transaction` avec verrou |
| **Short code généré avec 3 tentatives seulement** | Échec possible sur bases avec 1M+ codes | Probabilité de collision ~38% au premier essai | Augmenter à 10+ tentatives ou 7 caractères |
| **Aucune protection retrait dernier OWNER** | Workspace sans propriétaire | OWNER unique change son rôle puis se fait retirer | Vérifier "au moins un OWNER" |
| **LandingPage orpheline après `permanentDelete`** | Données orphelines qui s'accumulent | 100 QR codes LANDING_PAGE hard-deletés → 100 LP orphelines | Cleanup job ou cascade delete |
| **Constantes métier hardcodées** (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION_MS`, `INVITATION_EXPIRY_DAYS`) | Modifications nécessitent changement de code | - | Déplacer dans `constants.ts` |

### Agent 2 — Domain Expert (DDD)

| Entité | Problème | Impact | Suggestion |
|---|---|---|---|
| **User** | `User.plan` dénormalisé, cohérence non garantie avec `stripeSubscriptionId` | État incohérent possible (subscription non-null + plan=FREE) | Validation applicative |
| **Workspace** | Double représentation du propriétaire : `ownerId` + `WorkspaceMember.role=OWNER` | Deux sources de vérité peuvent diverger | Supprimer `Workspace.ownerId` ou ajouter contrainte DB |
| **QRCode** | `metadata` typé `Json` → `Record<string, unknown>` | Aucune sécurité de type à la compilation | Discriminated union par QRType |
| **QRCode** | `moduleShape` stocké comme `String` (pas d'enum DB) | Valeur arbitraire possible | Enum Prisma ou CHECK constraint |
| **LandingPage** | Relation 1:1 optionnelle avec `onDelete: SetNull` → LP orphelines possible | Agrégat dépendant sans son parent | Envisager Value Object dans QRCode.metadata |
| **Scan** | Enregistrement fire-and-forget (best-effort, pas at-least-once) | Scans perdus si worker crash | Documenter la garantie "best-effort" |
| **AggregationWatermark** | Watermark date-based (pas id-based) — scans avec `scannedAt` dans le passé peuvent être manqués | Données analytics manquantes | Utiliser id-based watermark |

### Agent 3 — Use Cases Review

| Use case | Problème | Type | Suggestion |
|---|---|---|---|
| `qr.create` | Routeur fetch workspace ET owner avant que le service ne refasse la même requête — double check de limite | **Trop grand / duplication** | Supprimer la double requête et le double check |
| `qr.update` | 1) Requête QR code dupliquée (router + service) 2) 4 responsabilités (metadata + design + landing page + SVG) | **Trop grand / couplé** | Supprimer requête router. Séparer updateContent / updateDesign |
| `qr.updateStatus` | Vérification rôle dans le service (contrairement aux autres mutations qui la font dans le routeur). 2e appel DB pour récupérer le plan | **Incohérent** | Aligner les vérifications |
| `qr.softDelete/restore/permanentDelete` | `restore` a race condition. `permanentDelete` exposé directement à l'utilisateur (devrait être job CRON après 30 jours) | **Règle manquante** | Pattern corbeille classique |
| `billing.handleWebhookEvent` | 3 événements + idempotency + error handling dans une méthode. Aucun effet de bord sur downgrade | **Trop grand** | Séparer par événement + ajouter `postDowngradeEffects()` |
| `auth.register` | 3 créations sans transaction — user orphelin si workspace échoue | **Pas de transaction** | `$transaction` |
| `analytics.recordScan` vs `recordScanInBackground` | Duplication complète du code | **Duplication** | Factoriser `recordScanCore()` |
| `team.invite` | Email fire-and-forget — perte silencieuse | **Manque résilience** | Queue de retry + bouton renvoyer |
| `qr.getAnalytics` | Calcul de `retentionDays` dans le routeur (règle métier dans couche API) | **Logique métier dans routeur** | Extraire `getRetentionDays(plan)` dans le service |
| `aggregationService.backfillAll` | Delete-all initial → perte données si processus interrompu | **Pas résilient** | Traitement par lots avec checkpoint |

---

## 💾 ÉTAPE 4 — Data Access Review (3 agents)

### Agent 1 — Repository Review

| Repository | Méthode | Problème | Suggestion |
|---|---|---|---|
| `qr.service.ts` | `checkPlanLimit()` l.57-69 | Duplicata de vérification (appelée depuis router ET depuis create()) | Supprimer du router |
| `qr.router.ts` | `getById` l.68-71 | **Retourne entité Prisma complète** (fuite ORM) — expose `landingPageId`, `workspaceId`, etc. | DTO avec `select` explicite |
| `qr.router.ts` | `getAnalytics`, `exportCsv`, `exportPng`, etc. | **6 `findFirst` dupliqués** pour validation existence | Middleware tRPC + service gère NOT_FOUND |
| `api-key.service.ts` | `generate()` | Vérification plan dupliquée (router + service) | Supprimer du service |
| `qr.router.ts` | `update` l.97-116 | **3 accès DB** pour une simple màj (workspaceQuery + findFirst QR + findFirst dans service) | Passer workspaceId directement |
| `team.service.ts` | `listMembers()`, `listInvitations()` | Absence de pagination sur les listes | Ajouter `take: 50` + curseur |
| `qr.service.ts` | `update()` l.167-263 | Logique métier (SVG, metadata, LandingPage) dans le data access | Extraire dans fonctions pures |
| `qr.service.ts` | `generateUniqueShortCode()` l.71-78 | Race condition check-then-insert | Utiliser contrainte unique + catch P2002 |
| `stripe-idempotency.ts` | Tout le fichier | **Code mort potentiel** — pas appelé | Vérifier usage ; supprimer si inutilisé |

### Agent 2 — Query Performance

| Niveau | Fichier/Méthode | Requête problématique | Explication | Solution |
|---|---|---|---|---|
| 🔴 Critique | `aggregation.service.ts` `_upsertBatch()` | `scanDaily.upsert()` en boucle — des milliers d'upserts individuels | Chaque upsert = transaction autonome | Batch SQL avec `INSERT ... ON CONFLICT DO UPDATE` |
| 🟠 Élevé | `qr.router.ts` `list()` l.44-53 | `LIKE '%...%'` avec `mode: 'insensitive'` — **full table scan** | Aucun index utilisable pour `contains` | Index GIN/trigram |
| 🟠 Élevé | `cleanup-trash.worker.ts` l.39-46 | `findMany` avec filtre `workspace.owner.plan` via inclusion | Jointure 3 tables traversée | SQL direct avec jointure optimisée |
| 🟠 Élevé | `retention-cleanup.worker.ts` l.33-56 | Sous-requête corrélée avec DELETE | Join sur 3 tables pour chaque suppression | CTE + DELETE par ids |
| 🟡 Moyen | `analytics.service.ts` l.230-261 | 4 requêtes parallèles GROUP BY sur table brute Scan | Agrégations coûteuses si pas de ScanDaily | Réduire délai d'agrégation 60s→30s |
| 🟡 Moyen | `analytics.service.ts` l.114-152 | `findFirst` avec ORDER BY dans transaction | Latence ajoutée à chaque scan | Déplacer logique d'unicité dans ScanDaily |
| 🟡 Moyen | `qr.service.ts` `update()` | `include: { landingPage: true }` chargé pour TOUS les types | Surcharge inutile | Inclure conditionnellement |
| 🟢 Faible | `analytics.service.ts` `exportCSV()` | `take: 10000` sans pagination | Troncature silencieuse | Déprécier ; forcer `exportCSVPage()` |
| 🟢 Faible | `auth.service.ts` `register()` | 3 créations sans transaction | Utilisateur orphelin | `$transaction` |

### Agent 3 — ORM Review

| Entité/Fichier | Pattern problématique | Risque | Solution |
|---|---|---|---|
| `analytics.service.ts` | Transaction mêlant create + update + findFirst | Transaction longue, bloque autres écritures | Scinder : create rapide, update async |
| `auth.service.ts` | `as any` sur `totpBackupCodes` JSONB | Type safety désactivée | Table dédiée `BackupCode` |
| `qr.service.ts` | `as QRType`, `as Prisma.InputJsonValue` | Casts qui masquent erreurs | Type guards avant Prisma |
| `qr.service.ts` `update()` | QRCode + LandingPage pas dans une transaction | Incohérence si échec entre les deux | Envelopper dans `$transaction` |
| `api-key.service.ts` | 2 updates séquentiels sans transaction | `failedAttempts` reset mais `lastUsedAt` pas à jour | Combiner en un update |
| `cleanup-trash.worker.ts` | Filtre via relation imbriquée sur 3 tables | Seq scan sur PostgreSQL | Dé-normaliser `ownerPlan` sur QRCode |
| N/A (général) | **Aucune gestion d'optimistic concurrency** | Écriture concurrente écrase sans alerte | Champ `version` sur QRCode |
| `qr.service.ts` `updateStatus()` | Vérification d'autorisation dans le service | Logique d'autorisation qui devrait être dans middleware | Déplacer dans le middleware |
| `dashboard.ts` | Propriétés `lastScannedAt` incluses dans selects inutiles | Chargement excessif | Aligner select sur champs affichés |
| `team.service.ts` `invite()` | **5 requêtes DB séquentielles** | Latence élevée | `Promise.all` pour requêtes indépendantes |

---

## 🗄️ ÉTAPE 5 — Database Review (3 agents)

### Agent 1 — DBA Review

| Table | Colonne/Index | Problème | Recommandation SQL |
|---|---|---|---|
| **User** | `loginAttempts`, `lockoutUntil`, `totpSecret`, `totpEnabled`, `totpBackupCodes`, `totpVerifiedAt` | **🔴 6 colonnes manquantes en DB** — existent dans schema.prisma mais AUCUNE migration ne les a créées | `ALTER TABLE "User" ADD COLUMN ...` |
| **QRCode** | `destinationUrl`, `wifiSsid`, `wifiPassword`, `wifiEncryption`, `vcardJson`, `textContent` | **6 colonnes orphelines** — migration JSONB effectuée mais colonnes plates jamais supprimées | `ALTER TABLE "QRCode" DROP COLUMN ...` |
| **Account** | `type` | Pas de CHECK constraint — valeurs valides seulement dans l'app | `ALTER TABLE "Account" ADD CONSTRAINT ... CHECK (type IN ('oauth','email','credentials'))` |
| **QRCode** | `moduleShape` | Stocké comme TEXT sans CHECK — n'importe quelle valeur acceptée | `ALTER TABLE "QRCode" ADD CONSTRAINT ... CHECK (moduleShape IN ('square','rounded','dots'))` |
| **WorkspaceInvitation** | `expiresAt` | Aucune contrainte `expiresAt > createdAt` | `CHECK ("expiresAt" > "createdAt")` |
| **Scan** | Toutes FK | `ON DELETE CASCADE` sans archivage avant suppression | Trigger BEFORE DELETE vers table d'archive |
| **VerificationToken** | `@@unique([identifier, token])` | Redondant avec `@unique` sur `token` — double index | Supprimer le composite |
| **QRCode** | `@@index([workspaceId, createdAt])` | Index composite manquant | `CREATE INDEX ON "QRCode"("workspaceId", "createdAt" DESC)` |
| **Scan** | `@@index([qrCodeId, ipHash])` | `scannedAt` manquant dans l'index composite | `CREATE INDEX ON "Scan"("qrCodeId", "ipHash", "scannedAt")` |

### Agent 2 — Database Scalability

| Risque | Impact à x10 | Impact à x100 | Mitigation |
|---|---|---|---|
| **Scan non partitionnée** | 10M lignes, OK avec index | 100M-1B lignes — VACUUM peine, I/O-bound | Partitionnement mensuel déclaratif |
| **ScanDaily màj JSONB fréquentes** | 100K updates/jour, OK | 1M updates/jour — bloat TOAST | Table dédiée par dimension ou colonnes stables |
| **`referer` TEXT dans table principale** | Acceptable | TOAST I/O goulot | Table séparée `scan_referers` |
| **Soft delete sans purge** | 100K codes supprimés | 1M+ codes — storage gaspillé, queries ralenties | Purge CRON à 90 jours + index partiel |
| **Short code collision** | 10M codes, collisions rares | 100M codes, boucle de contention | Passer à 12 caractères ou ULID |
| **Pool connexions non configuré** | OK | Épuisement du pool | PgBouncer + pool sizing |
| **Pas de read replica** | OK | Analytics en compétition avec writes | Offloader analytics sur read replica |

### Agent 3 — Data Integrity

| Table/Relation | Risque | Scénario de corruption | Solution |
|---|---|---|---|
| **User** (6 colonnes manquantes) | **🔴 Crash à la première connexion** | `prisma.user.update({ data: { loginAttempts: { increment: 1 } } })` → "column does not exist" | **Urgent**: ALTER TABLE + CI check |
| **QRCode→LandingPage** (création) | LandingPage créée hors transaction | Si QRCode échoue, ligne LandingPage orpheline | Déplacer dans la `$transaction` |
| **QRCode→LandingPage** (unicité) | 2 requêtes concurrentes créent 2 LP | La seconde échoue sur contrainte unique, LP inutilisée | Verrouillage avant création LP |
| **Workspace** (suppression owner) | `onDelete: Cascade` → tout supprimé | Suppression user → des millions de scans perdus | Changer en `onDelete: Restrict` |
| **Scan** (cascade avant archivage) | Perte définitive données analytics | DELETE QR écrasé → scans irrécupérables | Trigger BEFORE DELETE vers `scan_archive` |
| **Soft delete** (filtrage systématique) | Requêtes incluent codes supprimés | Dashboard montre codes supprimés comme actifs | Vue Prisma avec WHERE deletedAt IS NULL |
| **Scan recordScan uniqueScans** | Race condition sur compteur unique | 2 requêtes simultanées → les deux incrémentent `uniqueScans` | Advisory lock ou table daily unique set |
| **ScanDaily aggregation** | Double-count au redémarrage worker | Worker crash après màj ScanDaily mais avant màj watermark | Atomic watermark + idempotent upsert |

---

## 🏗️ ÉTAPE 6 — Infrastructure Review (3 agents)

### Agent 1 — Reliability

| Point de risque | Type de panne | Probabilité | Impact | Solution |
|---|---|---|---|---|
| `withRetry` utilisé seulement sur Stripe (pas sur Prisma, Redis, Resend, Uploadthing) | Absence retry sur panne passagère | **H** | Élevé | Appliquer `withRetry` partout |
| Logging productif silencieux (`.info()` est no-op) | Perte visibilité opérationnelle | **H** | Élevé | Pino JSON |
| Aucun timeout Prisma | Requête pendante épuise pool | **M** | Critique | `statement_timeout` |
| Pas de circuit breaker (Redis, Stripe, Resend) | Cascade de défaillance | **M** | Élevé | `opossum` ou équivalent |
| `jwt.decode()` sans vérification | Contournement auth (déjà listé) | **H** | Critique | `jwt.verify()` |
| PgBoss sans DLQ | Jobs perdus après retries épuisées | **M** | Élevé | Activer DLQ |
| `getQueue()` singleton sans reconnection | Jobs bloqués si DB drop | **M** | Moyen | Health check + reset |
| Pas de retry sur Resend | Emails perdus | **M** | Moyen | `withRetry` |
| Géolocalisation sans fallback | Aucune donnée géo dans scans | **H** | Faible | MaxMind ou ip-api.com |
| Pas de graceful shutdown | Jobs perdus au redéploiement | **M** | Faible-Moyen | Handler SIGTERM |

### Agent 2 — Security (OWASP Top 10 + ASVS Level 2)

| Vulnérabilité | OWASP | Criticité | CVSS | Description | Solution |
|---|---|---|---|---|---|
| `jwt.decode()` au lieu de `verify()` | A2 Broken Auth | **Critical** | 9.1 | Attaquant forge token pour n'importe quel userId | `jwt.verify()` avec `NEXTAUTH_SECRET` |
| Logs d'erreur sans filtre données sensibles | A4 Data Exposure | **Medium** | 5.3 | `console.error(msg, ...args)` sans sanitization | Pino avec `redact` array |
| TOTP secret stocké en clair PostgreSQL | A2 Broken Auth | **High** | 7.5 | Secret utilisable si DB compromise | Chiffrement AES-256-GCM |
| Aucune validation ENV au démarrage | A5 Misconfiguration | **High** | 7.0 | 35+ vars avec `!` assertion → crash au runtime | Module `env.ts` avec Zod |
| `allowedOrigins` uniquement localhost:3000 | A1 Broken Access Control | **Low** | 3.1 | Bloquerait les server actions en staging/prod | `NEXTAUTH_URL` |
| CSP avec `unsafe-inline` (nécessaire Next.js RSC) | A5 Misconfiguration | **Medium** | 4.8 | XSS potentiel si injecteur inline existe | Surveiller bugtracker Next.js #45184 |
| SHA-256 IP hashing déterministe | A4 Data Exposure | **Low** | 3.7 | Même IP = même hash → traçabilité | HMAC avec sel périodique |
| `jsonwebtoken` 9.0.3 CVE RCE | A6 Vulnerable Components | **Critical** | 8.9 | CVE-2022-23529, CVE-2022-23540, CVE-2022-23541 | Update ≥9.0.4 ou migrer vers `jose` |
| Stripe webhook pas de rate limiting | A1 Broken Access Control | **Medium** | 5.0 | Burst d'events peut saturer DB | Rate limit + buffer PgBoss |

### Agent 3 — Observability & Cloud Ops

#### Zones aveugles

| Zone aveugle | Impact en cas d'incident | Instrumentation recommandée |
|---|---|---|
| Logs de prod supprimés (Pino jamais instancié) | Aucune visibilité en production | Pino JSON avec `redact` |
| Aucune métrique RED sur tRPC | Incidents non détectés avant utilisateurs | Middleware tRPC + Prometheus |
| Health-check basique (ne teste pas DB/Redis/PgBoss) | Pod K8s reste en service malgré DB inaccessible | `/api/health/ready` distinct de `/api/health/live` |
| Aucune métrique file d'attente PgBoss | Accumulation silencieuse = scans non enregistrés | `queue_depth`, `job_age_seconds` vers Prometheus |
| Aucune corrélation dans les logs | Requête intraçable dans les logs | `logger.child({ requestId })` |
| Sampling Sentry uniforme | Événements rares manqués | `tracesSampler` dynamique (100% pour 5xx, 10% succès) |
| Aucune métrique business | Impossible de dimensionner l'infrastructure | `users_registered_total`, `qrcodes_created_total`, `scans_recorded_total` |
| Cache Redis TTL 30-60s sans invalidation | Données possiblement obsolètes jusqu'à 60s | Surveiller hit-ratio cache |

#### Risques opérationnels

| Risque | Impact | Probabilité | Solution |
|---|---|---|---|
| Aucun Dockerfile / CI/CD / K8s manifests | Déploiement manuel non reproductible | **H** | Docker multi-stage + GitHub Actions + K8s |
| 25+ vars env sans validation | Outage total si variable critique manque | **M** | Validation Zod au démarrage |
| Aucun CI/CD visible | Pas de gate qualité, rollback compliqué | **H** | GitHub Actions (lint → typecheck → test → build → deploy) |
| Pas de réplicas DB (SPOF PostgreSQL) | Perte DB = perte totale | **M** | Read replica + backup automatisé |
| Upstash Redis sans fallback | Rate limit désactivé si Redis down | **M** | Fallback mémoire + alerte |
| Aucun auto-scaling configuré | Impossible d'absorber un pic de trafic | **M** | HPA + KEDA (queue depth) |
| Pas de RTO/RPO documentés | En cas de sinistre, perte de toutes les données | **H** | Backups PostgreSQL automatisés + WAL archiving |
| Pas de mise à jour auto des dépendances | Fenêtre d'exposition aux CVE | **M** | Dependabot + npm audit en CI |
| Pas de blue/green deployment | Rollback >15 min si régression | **M** | Blue/green K8s ou Vercel preview |
| Pas de test de charge en CI | Aucune garantie de tenue en charge | **M** | k6 ou artillery |

---

## 🏛️ ÉTAPE 7 — Synthèse Architecte

### 🔥 Critical Issues (Fix Before Next Deploy)

These issues represent **actual or imminent system failure** — security breach, app crash, or permanent data loss:

| # | Issue | Why Critical | Sources |
|---|-------|-------------|---------|
| 1 | **`jwt.decode()` au lieu de `jwt.verify()`** dans `verifyPartialToken` | Complete auth bypass — any attacker can forge a token for any `userId`. No signature check. | BE, Infra |
| 2 | **CSRF token hardcoded to `'1'`** | Static, non-cryptographic, trivially spoofed. CSRF protection is **entirely absent**. | FE, BE |
| 3 | **6 User columns missing from DB** — `loginAttempts`, `lockoutUntil`, `totpSecret`, `totpEnabled`, `totpBackupCodes`, `totpVerifiedAt` | **App crashes on login** with "column does not exist". Prisma schema declares them but no migration was run. | DB |
| 4 | **`jsonwebtoken` 9.0.3** — CVE-2022-23529 (RCE) + CVE-2022-23540 (alg confusion) | Crafted JWTs can achieve **remote code execution** or bypass signature verification entirely. | Infra |

**Fix order**: #1 → #2 → #4 → #3 (hours, not days).

### Top 20 problèmes (tous domaines confondus)

| Rang | Domaine | Problème | Impact | Effort | Source |
|---|---|---|---|---|---|
| 1 | **Sécurité** | `jwt.decode()` — pas de vérification signature dans `verifyPartialToken` | 🔴 **Catastrophique** — bypass auth total | S | BE, Infra |
| 2 | **Sécurité** | CSRF token hardcodé `'1'` — protection totalement absente | 🔴 **Critique** — toutes les mutations CSRFables | S | FE, BE |
| 3 | **Sécurité** | `jsonwebtoken` 9.0.3 avec CVE RCE | 🔴 **Critique** — RCE sur JWT mal formé | M | Infra |
| 4 | **DB** | 6 colonnes User manquantes en DB mais présentes dans le schéma | 🔴 **Critique** — crash au login | S | DB |
| 5 | **Données** | `auth.register()` — 3 créations sans transaction (user orphelin) | 🟠 **Haut** — données orphelines | M | Business, DA |
| 6 | **Données** | QRCode + LandingPage mis à jour hors transaction | 🟠 **Haut** — corruption sur échec partiel | M | DA, DB, Business |
| 7 | **Données** | LandingPage créée AVANT QRCode — orpheline si QRCode échoue | 🟠 **Haut** — lignes orphelines croissantes | M | DB, DA, Business |
| 8 | **Sécurité** | Pas de rate limiting TOTP / backup codes (endpoints publics) | 🟠 **Haut** — brute-force takeover | M | BE |
| 9 | **UI** | Mismatch HSL↔OKLCH — toutes les couleurs UI fausses | 🟠 **Haut** — UI incohérente | S | FE |
| 10 | **Perf** | Boucle d'upserts dans aggregation (N individuel au lieu de batch SQL) | 🟠 **Haut** — effondrement perf >10K QR | M | DA |
| 11 | **Perf** | `fs.readFileSync` synchrone dans tRPC async — bloque l'event loop | 🟠 **Haut** — spikes latence | S | BE |
| 12 | **Métier** | Race condition dans `restore()` — dépasse les limites plan | 🟠 **Haut** — bypass facturation | M | Business |
| 13 | **Obs** | Pino installé mais jamais utilisé — `logger.ts` est un no-op en prod | 🟡 **Moyen** — zéro log structuré | M | BE, Infra |
| 14 | **Infra** | Pas de timeout Prisma (`statement_timeout` non configuré) | 🟡 **Moyen** — blocages indéfinis | S | Infra |
| 15 | **Arch** | 6 vérifications existence dupliquées routers+services (2-3× requêtes DB) | 🟡 **Moyen** — endpoints ralentis | S | DA |
| 16 | **Infra** | Pas de validation ENV au démarrage — 35+ vars avec `!` | 🟡 **Moyen** — crash si var manquante | S | Infra |
| 17 | **Arch** | VIEWER peut créer des QR codes mais pas modifier/supprimer | 🟡 **Moyen** — bug modèle permissions | M | Business |
| 18 | **Infra** | Pas de health check (DB, Redis, PgBoss) | 🟡 **Moyen** — pannes non détectables | S | Infra |
| 19 | **Infra** | Aucun Dockerfile/CI-CD/K8s — déploiements manuels | 🟡 **Moyen** — pas de reproductibilité | L | Infra |
| 20 | **Data** | `totpBackupCodes` stocké JSON avec `as any` — pas de validation schéma | 🟡 **Moyen** — risque migration | S | BE, DA |

### 🧨 Dette technique critique (coûtera 10× plus dans 6 mois)

| Dette | Pourquoi elle grossit exponentiellement | Coût maintenant | Coût dans 6 mois |
|---|---|---|---|
| **Modèle QRCode monolithique** (7+ colonnes optionnelles type-dépendantes) | Chaque nouveau type ajoute des colonnes à TOUS les types | Modéré (gênant) | Très élevé (schéma inextricable) |
| **Table Scan non partitionnée** | Volume croît ; >100M lignes nécessite downtime pour partitionner | Aucun (aujourd'hui) | Paralysant (timeouts, pas de fenêtre migration) |
| **Double représentation du propriétaire** (`ownerId` + `role=OWNER`) | Chaque nouvelle fonctionnalité renforce la dualité | Modéré (2 sources de vérité) | Très élevé (6+ features dépendent de sources incohérentes) |
| **Pas de discipline transactionnelle** (register, QR create/update) | Chaque nouvelle mutation augmente le pool de code non transactionnel | Moyen (3 spots connus) | Très élevé (10+ spots, edge cases uniques) |
| **Chemins de code dupliqués** (Edge + Server `recordScan`) | La divergence s'accumule à chaque feature | Moyen (2 fonctions parallèles) | Très élevé (8+ fonctions divergentes) |
| **Pas de CI/CD + déploiements manuels** | Le processus de déploiement devient connaissance tribale | Moyen (script de déploiement existe) | Très élevé (bus factor, pas d'audit trail) |

### ⚠️ Risques à 6 mois

| Risque | Déclencheur | Conséquence |
|---|---|---|
| **Table Scan non partitionnée à >100M lignes** | Croissance organique ou campagne marketing | Timeouts requêtes, analytics inutilisables |
| **Pas de circuit breaker Stripe/Redis/Resend** | Indisponibilité tierce (Stripe downtime ~4h/an) | Panne en cascade sur toute l'appli |
| **PgBoss sans DLQ** | Crash worker sur traitement job | Jobs perdus silencieusement, pas de rejeu |
| **Pas de stratégie backup / RTO/RPO** | Corruption DB ou suppression accidentelle | Perte permanente de données |
| **Secrets TOTP stockés non chiffrés** | Audit conformité ou brèche | Amendes GDPR/HIPAA, notification obligatoire |
| **Pas de logs structurés / IDs de corrélation** | Incident production nécessitant investigation | Debug manuel — heures vs minutes |
| **Tous les checks permissions sont ad-hoc** | Base de code grandissante = surface d'attaque grandissante | Authorization inconsistante, escalade de privilèges |
| **User.plan couplé aux champs Stripe** | Changement de prestataire ou nouveau plan | Réarchitecture auth + billing, migration DB |

### 🔮 Risques à 2 ans

| Risque | Pourquoi c'est important | Chemin à suivre |
|---|---|---|
| **App Next.js monolithique pour tout** | Build time, code-splitting, couplage déploiement — à 100K+ LOC, vélocité -30 à 50% | Extraire billing + analytics en services séparés (année 2) |
| **QRCode Single Table Inheritance** | 7+ colonnes optionnelles → 20+ en 2 ans. Schéma union de tous les types | Migrer vers tables par type avec union discriminée (année 1.5) |
| **Pas d'architecture événementielle** | Side effects couplés au cycle request-response | Domain events avec PgBoss handlers (année 1-1.5) |
| **Pas de stratégie de versioning API** | Clients mobile/tiers cassés sur changements schema | Entête `Accept-version` ou préfixe URL (année 1) |
| **Pas de playbook d'évolution de schéma** | Migrations DB peuvent casser les requêtes en cours | Migration testing + backward-compat CI + rollouts progressifs (année 1) |
| **Pas d'isolation multi-tenant en DB** | Tous les tenants partagent les tables. Problème noisy-neighbor | Row-level security par workspaceId (année 1.5-2) |

### 📅 Plan d'action priorisé

#### Sprint 1 — Correctifs critiques (semaine 1-2)
**Objectif :** Arrêter l'hémorragie. Corriger les failles sécurité, les chemins de corruption de données, et les crashes.

| # | Action | Effort | Domaine |
|---|---|---|---|
| 1 | **`jwt.decode()` → `jwt.verify()`** dans `auth.service.ts:verifyPartialToken` | 1h | BE |
| 2 | **Remplacer CSRF hardcodé `'1'`** par token par session | 2h | FE + BE |
| 3 | **Upgrade `jsonwebtoken`** ≥9.0.4 (ou migrer vers `jose`) | 4h | BE |
| 4 | **Migration DB : ajouter 6 colonnes User manquantes** | 2h | DB |
| 5 | **`auth.register()` : envelopper dans `$transaction`** | 4h | BE |
| 6 | **QRCode + LandingPage : envelopper dans `$transaction`** | 3h | BE |
| 7 | **LandingPage : créer dans la même transaction que QRCode** | 2h | BE |
| 8 | **Ajouter rate limiting TOTP/backup codes** (5/IP/min) | 4h | BE |
| 9 | **Ajouter Prisma query timeout** (`statement_timeout = '10s'`) | 1h | BE |
| 10 | **Ajouter validation ENV au démarrage** (Zod → crash si absent) | 3h | BE |
| 11 | **Fixer `fs.readFileSync` → `fs.promises.readFile`** dans `qr-generator.ts` | 1h | BE |
| 12 | **Fixer mismatch HSL↔OKLCH** (homogénéiser globals.css + tailwind.config.ts) | 2h | FE |
| 13 | **Fixer `@layer base` dupliqué** dans globals.css | 0.5h | FE |
| 14 | **Ajouter `lang="fr"`** dans `global-error.tsx` | 0.25h | FE |
| 15 | **Fixer race condition `restore()`** — transaction + verrou | 6h | BE |
| 16 | **VIEWER ne peut plus créer de QR codes** — ajouter vérification | 3h | BE |
| 17 | **Supprimer vérifications existence dupliquées** dans les routers | 4h | BE |

#### Sprint 2 — Stabilisation (semaine 3-6)
**Objectif :** Fiabilité, performance, dette bloquante.

| # | Action | Effort | Domaine |
|---|---|---|---|
| 1 | Remplacer boucle d'upserts par batch SQL `INSERT ... ON CONFLICT` | 1j | DA |
| 2 | Ajouter index composites : `QRCode(workspaceId, createdAt DESC)`, `Scan(qrCodeId, scannedAt, ipHash)` | 4h | DB |
| 3 | Ajouter index GIN trigram pour recherche LIKE | 2h | DB |
| 4 | Ajouter CHECK constraints manquantes (moduleShape, Account.type, expiresAt) | 4h | DB |
| 5 | DTO projection sur `qr.router.ts getById` — ne pas retourner entité Prisma brute | 6h | DA |
| 6 | Charger `landingPage` conditionnellement (seulement si type=LANDING_PAGE) | 2h | DA |
| 7 | Ajouter `withRetry` sur tous les appels Prisma, Redis, Resend | 1j | Infra |
| 8 | Remplacer `console.log` par Pino structuré (workers, services, routers) | 1.5j | BE, Infra |
| 9 | Ajouter ID de corrélation dans tous les logs (X-Request-ID) | 1j | Infra |
| 10 | Ajouter endpoint health check (DB + Redis + PgBoss) | 4h | Infra |
| 11 | Ajouter circuit breakers (Stripe, Redis, Resend avec `opossum`) | 1.5j | Infra |
| 12 | Configurer DLQ PgBoss | 4h | Infra |
| 13 | Fixer `window.confirm()` → `<AlertDialog>` dans `qr-code-list-client.tsx` | 6h | FE |
| 14 | Fixer éléments interactifs imbriqués dans `qr-card.tsx` | 4h | FE |

#### Sprint 3 — Amélioration (mois 2-3)
**Objectif :** Refactoring, observabilité, design system, tests.

| # | Action | Effort | Domaine |
|---|---|---|---|
| 1 | Split `billing.handleWebhookEvent` en handlers par événement | 2j | Business |
| 2 | Notification + vérification quota sur downgrade plan | 1j | Business |
| 3 | Type safe payload dans `qr-creator/index.tsx` | 6h | FE |
| 4 | Fixer biais modulo `getRandomInt` → `crypto.randomInt` | 1h | FE |
| 5 | Externaliser constantes métier dans `constants.ts` | 1j | Business |
| 6 | Accessibilité : aria-hidden, role="status", aria-label sur Skeleton | 1h | FE |
| 7 | Tailles boutons WCAG 44×44px | 4h | FE |
| 8 | Couleurs design tokens dans `current-plan-banner.tsx` | 3h | FE |
| 9 | Validation plan payant dans `apiKey.validate()` | 1j | BE |
| 10 | Chiffrement secrets TOTP au repos (AES-256-GCM) | 1j | BE |
| 11 | Dockerfile + .dockerignore production | 1j | Infra |
| 12 | Pipeline CI (lint → tsc → vitest → build) | 1j | Infra |
| 13 | Unifier `recordScan` + `recordScanInBackground` | 1.5j | BE |
| 14 | Résoudre dualité propriétaire — `Workspace.ownerId` comme source unique | 2j | Business |

#### Horizon 6 mois — Évolution

| Initiative | Rationalité | Effort | Trimestre |
|---|---|---|---|
| **Partitionnement table Scan par mois** | Évite les timeouts à grande échelle | 3j | T3 |
| **Migrer QRCode monolithique → tables par type** | Élimine les colonnes optionnelles type-dépendantes | 2sem | T3 |
| **Archivage Scan avant cascade delete QRCode** | Préserve les données analytics | 2j | T3 |
| **Définir RTO/RPO + stratégie backup** | Conformité + disaster recovery | 1sem | T3 |
| **Manifestes K8s** (Deployment, Service, HPA, PDB) | Scalabilité horizontale, zero-downtime | 2sem | T3-T4 |
| **Pipeline CD** (GitHub Actions → Docker → K8s) | Déploiements automatisés | 1sem | T4 |
| **Séparer User.plan de Stripe** — extraction contexte billing | Découpler fournisseur paiement | 1.5sem | T4 |
| **Domain events** cycle de vie QRCode | Découpler side effects | 2sem | T4 |
| **Tests intégration complets** (API-level, tous les flux critiques) | Prévenir régressions | 2sem | T3 |
| **Tests de charge** (k6 — goulots à 1K/10K/100K req/s) | Capacity planning | 1sem | T4 |

### Score d'architecture global

| Domaine | Score | Facteurs clés |
|---|---|---|
| **Architecture** | 6/10 | Modèle QRCode monolithique, dualité propriétaire, pas de discipline transactionnelle, checks rôles ad-hoc |
| **Sécurité** | 3/10 | Auth bypass (jwt.decode), CSRF fake, CVE RCE connue, pas de rate limit, TOTP non chiffré |
| **Performance** | 6/10 | Sync file read dans async, boucle upserts, indexes manquants, pas de timeout |
| **Maintenabilité** | 6/10 | Casts TypeScript partout, code dupliqué, Pino inutilisé, console.log, 6 checks redondants |
| **Scalabilité** | 5/10 | Pas de partitionnement, indexes composites manquants, pas de circuit breakers, pas de K8s/CI-CD |
| **Observabilité** | 3/10 | Pas de logs structurés, pas d'IDs de corrélation, pas de health check, pas de validation ENV |
| **Score global** | **5/10** | |

### Verdict

**QrStudio a des choix de stack modernes et sensés (tRPC, Prisma, Next.js, TypeScript), mais le système est dangereusement fragile.** Trois failles de sécurité — un contournement d'authentification, un token CSRF factice, et une vulnérabilité RCE connue dans `jsonwebtoken` — pourraient chacune indépendamment mener à une compromission totale du système. Simultanément, des colonnes DB manquantes font crasher l'application au premier login, et l'absence de transactions garantit une corruption de données à terme.

**La voie pragmatique** : corriger les bugs critiques de sécurité et de données en 2 semaines, stabiliser performance et observabilité dans les 4 semaines suivantes, puis refondre systématiquement le modèle QRCode monolithique et extraire les contextes bornés sur 6 mois. Le codebase est récupérable et les patterns sont corrects — le gap c'est la discipline d'exécution sur les fondamentaux (transactions, migrations, logging, retry). Un investissement ciblé de 6 semaines produit un système **7/10** ; deux ans d'évolution incrémentale en font une plateforme **9/10**.

### Causes racines (clusters)

| Cause racine | Problèmes causés | Sprint |
|---|---|---|
| **1. Infrastructure Auth/Authz faible** | jwt.decode, CSRF '1', CVE jsonwebtoken, pas de rate limit, checks rôles ad-hoc, TOTP non chiffré | S1 |
| **2. Transactions manquantes** | register orphelin, corruption QR update, LandingPage orpheline, race condition restore() | S1 |
| **3. Vide d'observabilité** | Pino inutilisé, console.log, pas d'IDs corrélation, pas de health check, pas de validation ENV | S2 |
| **4. Dérive schéma DB** | 6 colonnes manquantes, colonnes orphelines, indexes manquants, contraintes manquantes | S1-S2 |
| **5. Duplication de code** | 6 checks existence redondants, recordScan Edge+Server, boucle upserts, 4 requêtes SQL brutes | S2-S3 |
| **6. Érosion modèle domaine** | QRCode monolithique, dualité propriétaire, couplage Stripe dans User | S3-6M |
| **7. Pas d'infrastructure opérationnelle** | Pas de Docker/CI-CD/K8s, pas de timeouts/retry/circuit breakers, pas de backup | S2-6M |
| **8. Qualité UI/DS** | Mismatch HSL↔OKLCH, couleurs hardcodées, violations A11Y, responsive | S1-S3 |

