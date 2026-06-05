# 📋 Revue de Code — QrStudio

> **Date :** 3 juin 2026
> **Projet :** QR Studio — SaaS de génération et gestion de QR codes dynamiques
> **Version :** v0.1.0

---

## 📍 ÉTAPE 0 — Cartographie du Codebase

### Arborescence des modules clés

```
qrstudio-web/
├── src/
│   ├── app/                          # Next.js 15 App Router (34 fichiers)
│   │   ├── (auth)/                   # Auth pages (login, register)
│   │   │   ├── login/
│   │   │   │   ├── components/       # login-form, google-login-button
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   ├── components/       # register-form
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # Dashboard app (layout + pages)
│   │   │   ├── billing/             # page.tsx
│   │   │   ├── qr-codes/            # page.tsx (liste)
│   │   │   ├── qr/
│   │   │   │   ├── new/             # Création QR code
│   │   │   │   └── [id]/            # Détail + édition QR code
│   │   │   ├── settings/            # page.tsx
│   │   │   ├── team/                # page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Dashboard principal
│   │   │   └── dashboard-stats-client.tsx
│   │   ├── api/                     # API routes (4 endpoints)
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── qr/[shortCode]/
│   │   │   ├── trpc/[trpc]/
│   │   │   ├── uploadthing/
│   │   │   └── webhooks/stripe/
│   │   ├── l/[shortCode]/           # Redirect landing
│   │   ├── invite/[token]/          # Team invitation
│   │   ├── qr-not-found/
│   │   ├── qr-paused/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Landing page
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── global-error.tsx
│   │
│   ├── components/                  # 68 fichiers
│   │   ├── billing/                 # plan-cards, cancel-subscription, etc.
│   │   ├── layout/                  # sidebar, header, logo
│   │   ├── qr/                      # qr-card, qr-editor, qr-creator/* (15+ fichiers)
│   │   ├── settings/                # profile-form, security-form, api-key, danger-zone
│   │   ├── shared/                  # empty-state, loading-skeleton, confirm-dialog, etc.
│   │   ├── team/                    # member-list, invite-form, pending-invitations
│   │   └── ui/                      # shadcn/ui components (16 composants)
│   │
│   ├── hooks/                       # use-qr-list, use-analytics (2)
│   ├── lib/                         # 7 fichiers utilitaires
│   │   ├── constants.ts             # PLAN_LIMITS, QR_TYPES, etc.
│   │   ├── utils.ts                 # cn(), formatDate(), generateShortCode()
│   │   ├── validations.ts           # Zod schemas (QRCreate, QRUpdate, VCard, etc.)
│   │   ├── qr-generator.ts          # Génération SVG/PNG/PDF
│   │   ├── geo.ts                   # IP géolocalisation
│   │   ├── user-agent.ts           # Parse user-agent
│   │   ├── uploadthing.ts           # Upload config
│   │   └── trpc/                    # tRPC client helpers
│   │
│   ├── server/                      # Backend complet (14 fichiers)
│   │   ├── auth.ts                  # NextAuth v5 config
│   │   ├── db.ts                    # PrismaClient singleton
│   │   ├── db-edge.ts              # Prisma Accelerate client
│   │   ├── trpc.ts                  # tRPC init, context, middleware
│   │   ├── routers/                 # 6 routers tRPC
│   │   │   ├── _app.ts             # Root router
│   │   │   ├── auth.ts
│   │   │   ├── qr.ts
│   │   │   ├── team.ts
│   │   │   ├── billing.ts
│   │   │   └── apiKey.ts
│   │   └── services/                # 8 services métier
│   │       ├── auth.service.ts
│   │       ├── qr.service.ts
│   │       ├── team.service.ts
│   │       ├── billing.service.ts
│   │       ├── analytics.service.ts
│   │       ├── api-key.service.ts
│   │       ├── redirect.service.ts
│   │       └── email.service.ts
│   │
│   ├── middleware.ts                # Next.js middleware (rate limiting + auth)
│   └── types/                       # Types partagés
│       ├── index.ts
│       └── next-auth.d.ts
│
├── prisma/
│   └── schema.prisma                # Schéma BDD (10 modèles)
│
├── tests/                           # 15 fichiers de test
│   ├── unit/                        # Tests unitaires
│   │   ├── lib/                     # qr-generator, geo, user-agent, validations
│   │   └── services/               # analytics, qr, redirect
│   ├── integration/                 # Tests d'intégration
│   │   └── routers/                # auth, qr, team, api-key
│   └── e2e/                         # Tests E2E Playwright
│       ├── auth.spec.ts
│       ├── qr-crud.spec.ts
│       └── team-invite.spec.ts
│
├── instrumentation.ts              # Sentry instrumentation
├── instrumentation-client.ts       # Client-side Sentry
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── components.json                 # shadcn/ui config
├── postcss.config.mjs
└── eslint.config.mjs
```

### Stack technique détectée

| Technologie | Version | Usage |
|------------|---------|-------|
| **Next.js** | 15.5.19 | App Router, RSC, Server Actions |
| **TypeScript** | 5.x (strict) | Langage principal |
| **React** | 19.2.7 | UI Library |
| **tRPC** | 11.13.0 | API (procédures typées) |
| **Prisma** | 5.22.0 | ORM + Migrations |
| **PostgreSQL** | - | Base de données (via Prisma Accelerate) |
| **NextAuth.js** | 5.0.0-beta.31 | Authentification (JWT, credentials, Google) |
| **Tailwind CSS** | 3.4.19 | Styling |
| **shadcn/ui** | Base Nova | Design system (via `@base-ui/react`) |
| **Zod** | 3.25.76 | Validation |
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
| **sharp** | - | Traitement images (côté serveur) |
| **Vitest** | 4.1.8 | Tests unitaires |
| **Playwright** | 1.60.0 | Tests E2E |

### Points d'entrée principaux

1. **Root layout** → `src/app/layout.tsx` (TRPCProvider, Sentry, Toaster)
2. **Auth** → `src/server/auth.ts` (NextAuth v5 avec credentials + Google)
3. **API Gateway** → `src/app/api/trpc/[trpc]/route.ts` (tRPC HTTP handler)
4. **tRPC Router** → `src/server/routers/_app.ts` (5 sous-routers)
5. **Middleware** → `src/middleware.ts` (Rate limiting + Auth redirect)
6. **Webhook Stripe** → `src/app/api/webhooks/stripe/route.ts`
7. **Redirect QR** → `src/app/l/[shortCode]/page.tsx`

### Volume estimé

| Métrique | Valeur |
|----------|--------|
| Fichiers source (src/) | 136 fichiers |
| Lignes de code (src/) | ~10 036 LOC |
| Fichiers de test | 15 fichiers |
| Lignes de test | ~1 229 LOC |
| Composants UI | 16 composants shadcn/ui |
| Services métier | 8 services |
| Routers tRPC | 6 routers |
| Hooks React | 2 hooks |
| Modèles Prisma | 10 modèles |
| Enums Prisma | 4 enums |
| Migrations | (Prisma géré) |

### Dépendances externes principales

**Production (36 dépendances)** : @base-ui/react, @hookform/resolvers, @prisma/client, @prisma/extension-accelerate, @sentry/nextjs, @tanstack/react-query, @trpc/client, @trpc/next, @trpc/react-query, @trpc/server, @uploadthing/react, autoprefixer, bcryptjs, class-variance-authority, clsx, jspdf, lucide-react, next, next-auth, next-themes, postcss, prisma, qrcode, react, react-dom, react-hook-form, recharts, resend, shadcn, sonner, stripe, superjson, tailwind-merge, tw-animate-css, uploadthing, zod

**Développement (14 dépendances)** : ESLint, Playwright, Vitest, types/types, jsdom, tailwindcss, etc.

### Découpage en couches identifié

```
┌─────────────────────────────────────────────────┐
│                   PRESENTATION                    │
│  app/ (pages RSC + client) + components/ (UI)    │
├─────────────────────────────────────────────────┤
│              APPLICATION / API                    │
│  middleware.ts + server/routers/ (tRPC)          │
├─────────────────────────────────────────────────┤
│                    MÉTIER                         │
│  server/services/ (8 services)                    │
│  lib/validations.ts (Zod schemas)                │
│  lib/constants.ts (règles plan)                  │
├─────────────────────────────────────────────────┤
│                  DATA ACCESS                      │
│  server/db.ts (PrismaClient)                     │
│  prisma/schema.prisma (ORM models)               │
├─────────────────────────────────────────────────┤
│                 INFRASTRUCTURE                    │
│  Sentry (monitoring)                             │
│  Uploadthing (file storage)                      │
│  Stripe (paiement)                               │
│  Resend (email)                                  │
│  Prisma Accelerate (Edge DB)                     │
│  next.config.ts (CSP, headers, images)           │
└─────────────────────────────────────────────────┘
```

### Architecture des données (schéma relationnel)

```
User ──1:N──> Account
User ──1:N──> Session
User ──1:N──> WorkspaceMember
User ──1:N──> Workspace (as owner)
User ──1:N──> ApiKey
User ────1:1──> StripeCustomer

Workspace ──1:N──> QRCode
Workspace ──1:N──> WorkspaceMember
Workspace ──1:N──> WorkspaceInvitation

QRCode ──1:N──> Scan
QRCode ──1:1──> LandingPage
```

### Modèle de données (Prisma — 10 modèles)

| Modèle | Rôle |
|--------|------|
| `User` | Compte utilisateur (auth, plan, Stripe) |
| `Account` | OAuth accounts (NextAuth) |
| `Session` | Sessions (NextAuth) |
| `VerificationToken` | Email verification (NextAuth) |
| `Workspace` | Espace de travail (multi-tenant) |
| `WorkspaceMember` | Membre d'un workspace (role: OWNER/EDITOR/VIEWER) |
| `WorkspaceInvitation` | Invitation en attente |
| `QRCode` | QR code (type, design, stats) |
| `LandingPage` | Landing page liée à un QR code |
| `Scan` | Scan individuel (analytics) |
| `ApiKey` | Clé API utilisateur |

---

---

## 🖥️ ÉTAPE 1 — Front-End Review (6 agents)

### 🚨 Problèmes critiques

| # | Agent | Composant/Fichier | Description | Impact | Solution |
|---|---|---|---|---|---|
| C1 | UX / FE Arch | `src/app/(dashboard)/qr-codes/page.tsx` | Page liste QR codes **vide** — aucun rendu de liste. Affiche uniquement un Header et un texte | 🚨 Bloquant — Les utilisateurs ne peuvent pas voir leurs QR codes | Implémenter la grille de QRCard avec data fetching, filtres et pagination |
| C2 | FE Arch | `src/components/qr/qr-shortcode-info.tsx:12` | `window.location.origin` utilisé côté serveur → hydration mismatch | 🚨 Bloquant — Crash au rendu serveur | Utiliser `useEffect` ou `process.env.NEXT_PUBLIC_BASE_URL` |
| C3 | FE Arch / UX | `src/components/settings/api-key-manager.tsx`, `api-key-modal.tsx` | **Dialog imbriqué** (parent Dialog → Trigger → ApiKeyModal → DialogContent) | 🚨 Bloquant — Double overlay, comportement incohérent | Découpler les deux Dialog |
| C4 | UX / FE Arch | `src/components/qr/qr-creator/export-panel.tsx` | Callbacks d'export `onExportPng/Svg/Pdf` **jamais passés** depuis le parent | 🚨 Bloquant — Export totalement inopérant | Connecter les callbacks dans QRCreator/QRCreatorStepper |
| C5 | Design System | `src/app/globals.css:82-99` | **Bloc `@layer base` dupliqué** — le second écrase le premier | ⚠️ Focus ring incohérents | Supprimer les lignes 93-99 |
| C6 | UX | `logo-uploader.tsx:17`, `pdf-uploader.tsx:21` | `onUploadError={() => {}}` — erreurs upload **ignorées silencieusement** | ⚠️ Aucun feedback utilisateur en cas d'échec | Afficher un toast d'erreur |

### ⚠️ Améliorations importantes

| Agent | Composant/Fichier | Description | Solution |
|---|---|---|---|
| UX | `qr-detail-client.tsx:67` | Navigation après suppression vers `/` au lieu de `/dashboard/qr-codes` | Corriger la redirection |
| UX | `qr-detail-header.tsx:75`, `qr-detail-client.tsx:76` | Lien édition vers `/qr/${id}/edit` au lieu de `/dashboard/qr/${id}/edit` | Ajouter le préfixe /dashboard |
| DS | `current-plan-banner.tsx:22-25` | Couleurs hardcodées (`bg-blue-100`, `text-blue-800`) hors design tokens | Utiliser des classes sémantiques |
| FE Arch | `qr-creator/index.tsx`, `qr-editor.tsx` | `computeQRData()` **dupliqué** à l'identique dans 2 fichiers | Extraire dans un utilitaire partagé |
| UX | `layout.tsx:37` | `Sentry.ErrorBoundary` fallback texte non stylé | Utiliser un composant d'erreur cohérent |
| Design | `error.tsx`, `global-error.tsx` | Boutons "Réessayer" en `<button>` brut sans composant Button shadcn | Utiliser `<Button>` |
| Perf | `layout.tsx:9` | Police Geist chargée mais inutilisée (tailwind.config.ts utilise Inter) | Supprimer Geist |
| UX | `register-form.tsx:44`, `security-form.tsx:43` | `error.data?.code` peut être `undefined` silencieusement | Pattern de gestion d'erreur plus robuste |

### ✨ Détails de finition (polish)

| Description | Fichier | Effort |
|---|---|---|
| QRCard : menu dropdown invisible sur mobile (opacity 0 au hover) | `qr-card.tsx:77` | XS |
| PeriodSelector : touch target < 44px sur mobile | `period-selector.tsx:20-36` | XS |
| ShapeSelector : icônes unicode (█, ▣, ●) rendues différemment selon les OS | `shape-selector.tsx:12-14` | XS |
| VCardForm : `handleChange` recréé à chaque render (pas de useCallback) | `vcard-form.tsx:33` | XS |
| WifiForm : même pattern | `wifi-form.tsx:31` | XS |
| `dangerouslySetInnerHTML` pour SVG sans sanitization | `qr-visual-card.tsx:65` | XS |
| Icône Google SVG inline volumineuse (20 lignes) | `google-login-button.tsx:18-41` | XS |

### Score global Front-End

| Catégorie | Note | Justification |
|---|---|---|
| **Design** | 7/10 | Design system shadcn/base-nova bien appliqué, mais couleurs hardcodées persistent |
| **UX** | 5/10 | Page liste QR codes vide (éliminatoire). Exports cassés. Erreurs silencieuses |
| **Responsive** | 7/10 | Layout adaptatif bien géré. Risques de toucher <44px. Graphiques non testés à 320px |
| **Accessibilité** | 6/10 | Labels et aria corrects. Focus ring cassé par CSS dupliqué. SVG dangereux |
| **Maintenabilité** | 6/10 | computeQRData dupliqué, Dialog imbriqué, composants >200 lignes |

---

## ⚙️ ÉTAPE 2 — Back-End Review (8 agents)

### 🚨 Critiques (corriger immédiatement)

| Agent | Fichier/module | Description | Impact | Risque | Solution |
|---|---|---|---|---|---|
| 1,5 | `qr.service.ts:47-53` | Short code : seulement **3 tentatives** de retry | Échec création QR → 500 | Moyen | Boucle `while(true)` avec limite 100+ contrainte unique DB |
| 3,7 | `middleware.ts:5` | Rate limiting **in-memory** — ne scale pas en multi-instance | Bypass rate limit en production | Élevé | Redis / Upstash |
| 3,5 | `analytics.service.ts:59-82` | `recordScan` fait **3 writes DB synchrones** par scan | Latence redirect QR, perte de scans sous charge | Élevé | Queue asynchrone (Bull/PgBoss) |
| 3,5 | `analytics.service.ts:180-208` | CSV export sans pagination — fetch toutes les scans en mémoire | Timeout API, OOM > 100k scans | Moyen | Pagination cursor-based ou streaming |
| 3,5 | `analytics.service.ts:211-229` | `getScansByDay` charge TOUS les scans et groupe en JS | OOM / timeout pour QR codes populaires | Élevé | Aggregation SQL (GROUP BY) |
| 3 | `geo.ts:32` | Appel ip-api.com synchrone (3s timeout) dans flux redirect | Blocage redirect, rate limit externe | Élevé | Rendre async ou déplacer hors flux critique |
| 2,4 | `qr.ts:250-283` + `qr.service.ts:213-263` | `buildQRData` **dupliqué** dans router ET service | Maintenance : 2x modifications, risque désync | Moyen | Supprimer la version router |
| 3 | `stripe/route.ts` | Webhook Stripe sans **idempotency** | Doublon mise à jour plan | Élevé | Stocker event.id en DB |
| 5 | `schema.prisma:191-205` | LandingPage sans cascade delete | Orphelins en base | Moyen | Ajouter `onDelete: Cascade` |

### 🔒 Sécurité

| Vulnérabilité | OWASP | Criticité | Solution |
|---|---|---|---|
| Rate limit in-memory contournable | A4:2021 | **High** | Redis distribué |
| Pas d'idempotency Stripe | A1:2021 | **High** | Table WebhookEvent |
| IP spoofing via x-forwarded-for | A1:2021 | **Medium** | Valider IP, configurer trust proxy |
| SVG injection potentielle | A3:2021 | **Low** | Valider output SVG |

### ⚡ Performance

| Problème | Impact | Solution |
|---|---|---|
| `recordScan` synchrone (3-4 DB calls) | +100-300ms latence redirect | Queue asynchrone |
| CSV export sans streaming | OOM > 50k scans | Pagination |
| `getScansByDay` charge tout en mémoire | Latence > 5s pour QR populaires | GROUP BY SQL |
| Rate limit in-memory | 0 protection en cluster | Redis |
| Géolocalisation synchrone (3s timeout) | Bloque redirect | Hors flux critique |

### 📋 Dette technique

| Description | Coût ignoré | Effort |
|---|---|---|
| Architecture analytics synchrone → réécriture nécessaire | **Très élevé** | XL (3-4 semaines) |
| Rate limiting in-memory → urgence en production | **Moyen** | S (Redis) |
| Pas d'idempotency Stripe → risque double billing | **Élevé** | M |
| Duplication buildQRData → bugs silencieux | **Moyen** | XS |

### Score global Back-End

| Domaine | Note | Justification |
|---|---|---|
| **Architecture** | 7/10 | Bonne séparation routers/services, SRP violé dans services |
| **Sécurité** | 6/10 | Bonnes pratiques de base. Faiblesses : rate limit, idempotency |
| **Performance** | 5/10 | Point noir : recordScan synchrone, analytics sans agrégation SQL |
| **Maintenabilité** | 8/10 | Code propre, bien typé. Duplication buildQRData à corriger |
| **Scalabilité** | 4/10 | 3 blocages majeurs : rate limiting, analytics, géolocalisation |
| **Observabilité** | 4/10 | Sentry présent, pas de logs structurés, pas de health check |

---

## 🏢 ÉTAPE 3 — Business Layer Review

### 📊 Business Analyst

| Problème | Impact | Cas concret | Suggestion |
|---|---|---|---|
| **Rétention analytics non appliquée** | Fuite de données payantes pour FREE | FREE avec `period='all'` voit 40 jours au lieu de 30 | Tronquer à `max(periodDate, now - retentionDays)` |
| **FREE peut PAUSER des QR codes** | Violation règle métier fondamentale | Un FREE met en pause → règle "jamais désactivés" violée | Ajouter guard `if (user.plan === 'FREE') throw FORBIDDEN` |
| **WHATSAPP : double sanitization casse l'URL** | QR WHATSAPP systématiquement brisés | `https://wa.me/httpswame0612345678` au lieu de `https://wa.me/0612345678` | Normaliser en amont : chiffres → `https://wa.me/{chiffres}` |
| **Downgrade plan sans gestion dépassement** | Contournement des limites FREE | PRO avec 50 codes → FREE = 50 codes toujours actifs | Bloquer la création tant que quota dépassé |
| **Webhook `subscription.updated` bugué** | Changements plan non répercutés | Downgrade Stripe → base non mise à jour | Inverser la logique : toujours chercher le user et appliquer |
| **Race condition sur les limites** | Dépassement des limites plan | 2 créations simultanées → 6 QR codes au lieu de 5 | Transaction Prisma avec sérialisation |

### 🧩 Domain Expert

| Entité | Problème | Impact | Suggestion |
|---|---|---|---|
| **User.plan** | Plan stocké au niveau User, limite comptée par workspace | Règle ambiguë multi-workspace | Documenter : "limites par workspace" |
| **Workspace** | Dualité `ownerId` + `WorkspaceMember(role=OWNER)` | Risque de désynchronisation | Supprimer `Workspace.ownerId` |
| **QRCode** | God object avec 10+ champs optionnels type-dépendants | Ajouter un type = migration avec nouveaux champs NULL | Envisager JSONB ou tables filles |
| **QRCode.landingPageId** | LandingPage orpheline si création QR échoue | Orpheline possible | Wrapper en transaction Prisma |
| **Scan** | Pas de politique de purge | Performance dégradée, coût stockage | Job de purge basé sur retentionDays |
| **User.stripeCustomerId** | Infra Stripe leakée dans entité domaine | Couplage technique | Extraire dans table `Subscription` |

### 🔄 Use Cases

| Use case | Problème | Type | Suggestion |
|---|---|---|---|
| **qr.create** | 6 responsabilités dans 1 appel | **Trop grand** | Diviser : persistance QR + génération SVG déléguée |
| **qr.create** | `checkPlanLimit` appelé dans router ET service | **Dupliqué** | Supprimer du router |
| **qr.updateStatus** | Bypasse totalement le service | **Mal découpé** | Déplacer dans `qrService.updateStatus()` |
| **qr.delete** | Vérification rôle manuelle | **Mal découpé** | Utiliser `requireRole(workspace.role, ['OWNER'])` |
| **billing.handleWebhookEvent** | Bug logique `subscription.updated` | **Bug** | Toujours appliquer la mise à jour |
| **team.invite** | Vérification limites APRÈS vérification inviteur | **Ordonnancement** | Fail fast : vérifier limites d'abord |
| **team.invite** | Email fire-and-forget : perte possible | **Orchestration** | Flag `emailSent` ou file de rattrapage |

---

## 💾 ÉTAPE 4 — Data Access Review

### 🗄️ Repository Review

| Repository | Méthode | Problème | Suggestion |
|---|---|---|---|
| trpc.ts | `createTRPCContext()` | `db: PrismaClient` exposé → incite à bypasser les services | Supprimer `db` du contexte tRPC |
| routers/qr.ts | `create` | **Double fetch** workspace (router + service) | Supprimer le fetch du router |
| routers/qr.ts | `update` | **Double fetch** QR code (router + service) | Supprimer le fetch du router |
| routers/qr.ts | 7x `findFirst` | Appels quasi-identiques répétés | Extraire `qrRepository.getByIdOrThrow()` |
| routers/qr.ts | `updateStatus` | Logique mutation entièrement dans le routeur | Migrer vers qrService |
| routers/qr.ts | `delete` | Vérification ownership + delete direct | Migrer vers qrService |
| routers/qr.ts | `getById` | Retourne entité Prisma complète (fuite ORM) | Mapper vers DTO typé |
| analytics.service.ts | `exportCSV` | `take: 10000` fixe, pas de pagination | Pagination cursor-based |
| analytics.service.ts | `getScansByDay` | Aucune limite sur le findMany | GROUP BY SQL |

### ⚡ Query Performance

| Niveau | Fichier/méthode | Problème | Solution |
|---|---|---|---|
| 🔴 | `getScansByDay` (L212) | Aggrégation in-memory — charge TOUS les scans | GROUP BY Prisma/SQL |
| 🔴 | `getDashboardStats` (L147) | Scan complet table Scan sans limite | Aggrégation SQL |
| 🟠 | `recordScan` (L68) | Requête redondante pour uniqueScans | Index composé + cache |
| 🟠 | `checkPlanLimit` (L33) | COUNT sur chaque création | Cache Redis 30s |
| 🟠 | `team.service.invite` (L9-68) | 5 requêtes séquentielles | Fusionner les requêtes |
| 🟠 | `qr.service.create` | Double round-trip workspace | Supprimer le fetch router |
| 🟡 | `getGroupedCounts` (L238) | Cast TypeScript fragile | Typer correctement |

### 🔄 ORM Review

| Entité | Pattern problématique | Risque | Solution |
|---|---|---|---|
| 🔴 `User` ↔ `Workspace` | Aucun `onDelete` sur `Workspace.owner` | `deleteAccount` **va échouer** | Ajouter `onDelete: Cascade` |
| 🔴 `QRCode` ↔ `LandingPage` | LandingPage sans cascade | Orphelins LandingPage qui s'accumulent | Ajouter `onDelete: Cascade` |
| 🟠 `db-edge.ts` | `as unknown as PrismaClient` | Type safety contournée | Définir un type personnalisé |
| 🟠 `team.service.ts` | Casts `role as "OWNER"|...` inutiles | Supprimer les casts |
| 🟡 `routers/qr.ts` | Entité Prisma exposée comme DTO | Couplage API↔DB | Définir QRCodeDTO |
| 🟡 `qr.service.ts` update | `include: { landingPage: true }` chargé pour tous les updates | SELECT joint inutile | Charger conditionnellement |

---

## 🗄️ ÉTAPE 5 — Database Review

### 🗄️ DBA Review

| Table | Colonne/Index | Problème | Recommandation |
|---|---|---|---|
| `VerificationToken` | *Aucun* | **Absence de clé primaire** explicite | Ajouter `id String @id @default(cuid())` |
| `User` | `@@index([email])` | **Index redondant** (déjà `@unique`) | Supprimer |
| `QRCode` | `@@index([shortCode])` | **Index redondant** (déjà `@unique`) | Supprimer |
| `WorkspaceInvitation` | `@@index([token])` | **Index redondant** (déjà `@unique`) | Supprimer |
| `ApiKey` | `@@index([keyHash])` | **Index redondant** (déjà `@unique`) | Supprimer |
| `User` | `email` | Aucune limite de longueur | `@db.VarChar(255)` |
| `QRCode` | 7 colonnes optionnelles type-dépendantes | **Violation 3NF** : 6 colonnes NULL/moyenne | Envisager JSONB ou tables filles |
| `QRCode` | `moduleShape` | CHECK constraint manquante | Utiliser enum Prisma |
| `Workspace` | `ownerId` | Pas de ON DELETE | Ajouter `onDelete: Restrict` |
| `QRCode` | `shortCode` | Aucune contrainte de longueur | `@db.VarChar(6)` |
| `LandingPage` | *Aucun* | Aucun index | `@@index([createdAt])` |

### 📈 Scalability

| Risque | Impact x10 | Impact x100 | Mitigation |
|---|---|---|---|
| `getScansByDay` (tout en mémoire) | ⚠️ Élevé (100k lignes) | 🔴 Critique (1M → OOM) | GROUP BY SQL |
| `getDashboardStats` (scans 7j) | ⚠️ Élevé (50k lignes) | 🔴 Critique (500k → timeout) | GROUP BY SQL |
| `recordScan` (3 écritures/scan) | ⚠️ Moyen | 🔴 Contention counters | Table counters dédiée |
| Absence partitionnement `Scan` | ✅ Aucun | 🔴 Index fragmentés | Partitions mensuelles |
| Export CSV (10k limite) | ✅ OK | 🟡 Limite arbitraire | Pagination curseur |
| Rétention analytics non appliquée | 🟡 Volume croît | 🔴 Aucune purge | Job cron de purge |
| Pool connexions non configuré | ✅ OK | 🟡 Saturation | Configurer connection_limit |

### 🔐 Data Integrity

| Table | Risque | Scénario | Solution |
|---|---|---|---|
| `recordScan` | **Pas de transaction** | Crash entre insert scan et update counters → données incohérentes | `prisma.$transaction()` |
| `uniqueScans` | **Race condition** | 2 scans simultanés même IP → les deux incrémentent | `SELECT FOR UPDATE` ou contrainte unique |
| `QRCode→LandingPage` | **LandingPage orpheline** | Suppression QR code sans cascade | `onDelete: Cascade` |
| `User→Workspace` | **Workspace orphelin** | Suppression user bloquée par FK | `onDelete: Restrict` |
| `acceptInvitation` | **Pas de transaction** | Crash entre création membre et update invitation | `prisma.$transaction()` |
| `invite` | **Race condition count** | 2 invitations simultanées → dépassement limite | SELECT FOR UPDATE |

---

## 🏗️ ÉTAPE 6 — Infrastructure Review

### 🔄 Reliability

| Point de risque | Type de panne | Probabilité | Impact | Solution |
|---|---|---|---|---|
| Aucun retry Stripe/Resend/Prisma | Transitoire (429, 5xx) | **H** | Erreur 500 utilisateur | Retry backoff + jitter |
| Aucun timeout explicite | Blocage connexion | **M** | Connexion pendante 75s | `Stripe({ timeout: 10000 })` |
| Pas de circuit breaker | Cascade | **M** | Dégradation générale | `opossum` ou équivalent |
| Webhook non idempotent | Duplication | **M** | Double mise à jour plan | Table WebhookEvent |
| Rate limiter in-memory | Contournement | **H** | Quota x instances | Redis distribué |
| Pas de dead letter queue | Perte événements | **M** | Webhook échoué perdu | Logger + rejeu manuel |

### 🔒 Security

| Vulnérabilité | OWASP | Criticité | CVSS | Remédiation |
|---|---|---|---|---|
| Aucun verrouillage de compte | AT-002 | **Élevée** | 7.5 | Lockout après 5 échecs |
| `'unsafe-inline'` dans CSP | CS-001 | **Moyenne** | 5.3 | Utiliser nonce |
| `'unsafe-eval'` dans CSP | CS-001 | **Moyenne** | 5.3 | Retirer si possible |
| Secrets ENV avec `!` | SM-001 | **Moyenne** | 5.0 | Validation explicite au démarrage |
| Password strength non validé | AT-001 | **Basse** | 4.0 | Zod `.min(8).regex(...)` |

### 📊 Observability

| Zone aveugle | Impact | Instrumentation |
|---|---|---|
| Appels Stripe non tracés | Impossible de diagnostiquer latence Stripe | Span Sentry personnalisé |
| Emails Resend non tracés | Taux d'échec inconnu | Span Sentry + compteur |
| Rate limiter sans métrique | Attaque indétectable | Counter `rate_limit.blocked` |
| Pas de health check | Déploiement risqué | `GET /api/health` + readiness |
| Pas de correlation ID | Debugging lent | `X-Request-ID` middleware |
| Logs non structurés | Agrégation impossible | Logger JSON (pino) |

### ☁️ Cloud & Ops

| Risque opérationnel | Impact | Probabilité | Solution |
|---|---|---|---|
| Déploiement sans zero-downtime garanti | Coupure service | **M** | Rolling updates Kubernetes |
| Pas de validation ENV au démarrage | Crash sur première requête | **M** | Module `env.ts` avec validation |
| Prisma Accelerate coûte cher | Surprise budgétaire | **L** | Budget alert |
| Pas de RTO/RPO défini | Récupération ad-hoc | **H** | Backups PostgreSQL + WAL |
| Pas de rotation des secrets | Fenêtre d'exposition infinie | **M** | Rotation trimestrielle + vault |
| Pas de dépendabot/npm audit | CVE non patchée | **M** | Dependabot + CI audit |

---

## 🏛️ ÉTAPE 7 — Synthèse Architecte

### Top 20 problèmes (tous domaines confondus)

| Rang | Domaine | Problème | Impact | Effort | Source |
|---|---|---|---|---|---|
| 1 | **Performance** | `recordScan` synchrone bloque le redirect QR (3-4 writes DB) | **🔴 Critique** | L | Back-End, DB |
| 2 | **Sécurité** | Rate limiting in-memory contournable en multi-instance | **🔴 Critique** | S | Back-End, Infra |
| 3 | **Sécurité** | Webhook Stripe sans idempotency — risque double billing | **🔴 Critique** | M | Back-End, Business |
| 4 | **Performance** | Aggrégation analytics in-memory (getScansByDay, dashboard) | **🔴 Critique** | M | Back-End, Data, DB |
| 5 | **UX** | Page liste QR codes vide — fonctionnalité principale absente | **🔴 Critique** | XL | Front-End |
| 6 | **UX** | Export Panel : callbacks jamais câblés (export inopérant) | **🔴 Critique** | M | Front-End |
| 7 | **Métier** | FREE peut PAUSER des QR codes (violation règle) | **🟠 Haut** | XS | Business |
| 8 | **Métier** | Rétention analytics non appliquée (fuite données payantes) | **🟠 Haut** | S | Business |
| 9 | **Métier** | WHATSAPP : double sanitization casse les liens | **🟠 Haut** | XS | Business |
| 10 | **Métier** | Webhook `subscription.updated` bugué (ne met pas à jour) | **🟠 Haut** | S | Business, Back-End |
| 11 | **Architecture** | Analytics synchrone : nécessite réécriture complète du pipeline | **🟠 Haut** | XL | Back-End, DB |
| 12 | **Data** | `deleteAccount` échoue (pas de cascade sur Workspace.owner) | **🔴 Critique** | XS | Data, DB |
| 13 | **Data** | LandingPage orpheline à la suppression QR code | **🟠 Haut** | XS | Data, DB |
| 14 | **Performance** | Géolocalisation IP synchrone (api-api.com, 3s timeout) | **🟠 Haut** | M | Back-End |
| 15 | **Architecture** | Duplication `buildQRData` (router + service) | **🟡 Moyen** | XS | Back-End |
| 16 | **Sécurité** | Aucun verrouillage de compte (brute-force possible) | **🟡 Moyen** | S | Infra |
| 17 | **Scalabilité** | Table Scan sans partitionnement ni purge de rétention | **🟡 Moyen** | M | DB, Business |
| 18 | **Qualité** | Dialog imbriqué dans ApiKeyManager (comportement cassé) | **🟡 Moyen** | S | Front-End |
| 19 | **Qualité** | `computeQRData()` dupliqué dans 2 composants | **🟡 Moyen** | XS | Front-End |
| 20 | **Observabilité** | Pas de logs structurés, pas de health check | **🟡 Moyen** | S | Infra |

### 🧨 Dette technique critique (coûtera 10x plus dans 6 mois)

1. **Pipeline analytics synchrone** — Architecture actuelle (recordScan bloque le redirect, aggrégation JS, pas de cache). À 100k scans/mois, les temps de réponse analytics deviendront inacceptables. Réécriture nécessaire : queue asynchrone + aggregation SQL + cache Redis. **Coût si ignoré : réécriture d'urgence sous pression production.**

2. **Rate limiting in-memory** — Fonctionne en monolithe. Dès la première scalabilité horizontale (2+ instances), la protection est contournable par 2x. **Coût si ignoré : incident sécurité production.**

3. **Webhook Stripe non idempotent** — Stripe garantit "at least once". Sans déduplication, un réseau instable ou un timeout client peut causer un double traitement (double abonnement, double facture). **Coût si ignoré : remboursement client + support technique.**

4. **Page liste QR codes vide** — La fonctionnalité principale du produit n'est pas implémentée. L'application est en production sans que les utilisateurs puissent voir leurs QR codes. **Coût si ignoré : produit inutilisable.**

### ⚠️ Risques à 6 mois

1. **Performance analytics** : Sans agrégation SQL, les requêtes analytics deviendront inutilisables dès 50k+ scans par QR code. Le dashboard chargera des centaines de milliers de lignes en mémoire.
2. **Dépassement des limites plan** : Sans transaction sur `checkPlanLimit` et `invite`, les utilisateurs peuvent contourner les limites dès que 2 requêtes arrivent simultanément.
3. **Orphelins LandingPage** : La suppression de QR codes LANDING_PAGE laisse des LandingPage orphelines. En 6 mois, des centaines de lignes gaspillées.
4. **CSP affaibli** : Les `unsafe-inline` et `unsafe-eval` dans la CSP sont une faille XSS latente. Un bug dans une librairie tierce pourrait être exploité.
5. **Absence de verrouillage de compte** : Sans protection brute-force, un attaquant a 100% de chances de trouver un mot de passe faible dans les 30 premiers jours.

### 🔮 Risques à 2 ans

1. **Modèle QRCode monolithique** : Les 7 colonnes type-dépendantes (`wifiSsid`, `vcardJson`, etc.) rendent l'ajout de nouveaux types de QR (Email, SMS, Bitcoin, etc.) coûteux et risqué. À 15+ types, le schéma deviendra ingérable.
2. **Scan table non partitionnée** : Avec 10M+ lignes, toutes les requêtes analytics seront lentes. Le `VACUUM` PostgreSQL deviendra un goulot. La seule solution sera un partitionnement lourd avec downtime.
3. **Couplage User ↔ Stripe** : Les IDs Stripe (`stripeCustomerId`, `stripeSubscriptionId`) sont des champs sur `User`. Impossible de supporter plusieurs abonnements ou paiements alternatifs sans refonte du modèle.
4. **Absence de soft-delete** : La suppression physique des QR codes est irréversible. Aucun "corbeille" ou "historique" possible sans réécriture complète du CRUD.
5. **Workspace mono-propriétaire** : Le modèle `Workspace.ownerId` + `WorkspaceMember.OWNER` est redondant et limite les transferts de propriété. Pas de copropriété possible.

### 📅 Plan d'action priorisé

#### Sprint 1 — Correctifs critiques (semaine 1-2)

| # | Action | Effort | Agent |
|---|---|---|---|
| 1 | Implémenter la page liste QR codes (qrcodes/page.tsx) | XL | Front-End |
| 2 | Câbler les exports PNG/SVG/PDF dans QRCreator | M | Front-End |
| 3 | Ajouter cascade delete sur Workspace.owner et QRCode→LandingPage | XS | Data |
| 4 | Supprimer la duplication `buildQRData` (router vs service) | XS | Back-End |
| 5 | Ajouter `onDelete: Cascade` et corriger `VerificationToken` PK | XS | DB |
| 6 | Corriger le bug `subscription.updated` (webhook Stripe) | S | Business |
| 7 | Corriger la double sanitization WHATSAPP | XS | Business |
| 8 | Supprimer le Dialog imbriqué ApiKeyManager | S | Front-End |

#### Sprint 2 — Stabilisation (semaine 3-6)

| # | Action | Effort | Agent |
|---|---|---|---|
| 9 | Migrer le rate limiting vers Redis/Upstash | S | Infra |
| 10 | Ajouter l'idempotency sur le webhook Stripe | M | Infra |
| 11 | Rendre `recordScan` asynchrone (queue/Bull) | L | Back-End |
| 12 | Implémenter l'agrégation SQL pour getScansByDay/dashboard | M | Back-End, DB |
| 13 | Ajouter les index composites manquants (QRCode + Scan) | XS | DB |
| 14 | Ajouter un verrouillage de compte après 5 échecs | S | Infra |
| 15 | Bloquer PAUSED pour les utilisateurs FREE | XS | Business |
| 16 | Appliquer la rétention analytics (purge des vieux scans) | M | Business, DB |

#### Sprint 3 — Amélioration (mois 2-3)

| # | Action | Effort | Agent |
|---|---|---|---|
| 17 | Extraire `computeQRData()` dans un utilitaire partagé | XS | Front-End |
| 18 | Supprimer les couleurs hardcodées (current-plan-banner) | S | Front-End |
| 19 | Ajouter retry + timeout sur Stripe/Resend/Prisma | M | Infra |
| 20 | Rendre la géolocalisation IP asynchrone | M | Back-End |
| 21 | Ajouter un health check endpoint (/api/health) | XS | Infra |
| 22 | Mettre en place un logger structuré (JSON) | S | Infra |
| 23 | Ajouter les contraintes de longueur sur les colonnes | S | DB |
| 24 | Envelopper recordScan et acceptInvitation dans des transactions | M | Data |
| 25 | Ajouter un index sur LandingPage.createdAt | XS | DB |

#### Horizon 6 mois — Évolution

| # | Action | Effort | Agent |
|---|---|---|---|
| 26 | Refondre le pipeline analytics (queue + aggregation + cache) | XL | Back-End |
| 27 | Partitionner la table Scan par mois | L | DB |
| 28 | Migrer les colonnes type-dépendantes QRCode vers JSONB | L | DB |
| 29 | Ajouter des tests de concurrence (race conditions) | M | Tests |
| 30 | Ajouter MFA/TOTP pour l'authentification | M | Infra |
| 31 | Refondre le modèle Workspace (supprimer ownerId) | M | Back-End |
| 32 | Implémenter le soft-delete pour les QR codes | M | Back-End |

### Score d'architecture global

| Domaine | Score | Justification |
|---|---|---|
| **Architecture** | 6/10 | Bonne séparation couches mais SRP violé, fuites ORM, logique dans les routers |
| **Sécurité** | 6/10 | Bonnes bases (bcrypt, JWT, CSP). Faiblesses : rate limit, idempotency, brute-force |
| **Performance** | 4/10 | Analytics synchrone = point noir. Aggrégation JS au lieu de SQL. Géolocalisation bloquante |
| **Maintenabilité** | 7/10 | Code bien typé, propre. Duplications à corriger. Tests manquants sur zones critiques |
| **Scalabilité** | 4/10 | 3 blocages majeurs : rate limit, analytics, géolocalisation. Partitionnement DB absent |
| **Observabilité** | 4/10 | Sentry OK mais pas de métriques RED, logs structurés, health check, ou correlation ID |
| **Score global** | **5.2/10** | 🟡 Produit fonctionnel mais fragile. Nécessite des correctifs immédiats avant mise en production réelle |

### Verdict

**QR Studio est un projet bien structuré techniquement (TypeScript strict, tRPC, Prisma, shadcn/ui) avec une architecture claire et du code de qualité.** Cependant, il souffre de **problèmes bloquants** qui le rendent inexploitable en l'état : la page liste QR codes est vide (fonctionnalité principale absente), le pipeline analytics est synchrone et ne passera pas à l'échelle, le webhook Stripe peut causer des doublons de facturation, et le rate limiting est inefficace en production multi-instance.

**La priorité absolue est le Sprint 1** : corriger les bugs bloquants (liste QR codes, exports, cascade delete, duplication buildQRData, bug WHATSAPP, webhook Stripe). **Ensuite Sprint 2** : stabiliser la fiabilité (rate limit distribué, idempotency, analytics asynchrones, sécurité des comptes). Sans ces correctifs, le produit ne peut pas être mis en production de manière sûre.

**Points forts** : Stack moderne et cohérente, bonne séparation routers/services, design system shadcn bien implémenté, Sentry pour le monitoring, CSP bien configurée, bonnes pratiques de hash (bcrypt, SHA-256 pour API keys).

**Trajectoire recommandée** : Passer les 2 premiers sprints en priorité (6 semaines), puis attaquer la refonte du pipeline analytics (mois 2-3) avant de viser la scale x10. Le produit a un potentiel solide mais nécessite ces corrections fondamentales avant d'être présenté à des clients payants.

