# QR Studio — Master Plan pour Claude Code

> **Positionnement choisi :** Là où QR-Hero est un outil généraliste freemium qui monétise par le volume, QR Studio vise les **agences, freelances et petites équipes marketing** avec un modèle clair, honnête et sans piège. Tagline : *"QR codes that work after you print them — forever."*
>
> **L'angle différenciant :** Le marché QR souffre d'une crise de confiance documentée — désactivation des codes après la période d'essai, abonnements forcés, liens brisés sur du matériel imprimé. QR Studio répond à ça avec : codes dynamiques qui ne meurent jamais (même plan gratuit), pas de surprise à la résiliation, et un éditeur visuel que les non-techniciens peuvent utiliser seuls.

---

## Analyse de QR-Hero et du marché (pour orientation)

**Ce que fait QR-Hero :**
- QR codes dynamiques pour URL, WhatsApp, WiFi, Mobile Apps
- Analytics (scans totaux, uniques, géo, device)
- A/B testing entre deux destinations
- Geo-targeting (redirection selon pays)
- Génération en bulk
- Freemium : plan gratuit limité + Hero plan à 9,99 $/mois

**Failles exploitables du marché :**
1. **Le piège abonnement** : la plupart des concurrents désactivent les QR codes à la résiliation. Les utilisateurs découvrent ça après avoir imprimé du matériel. C'est le principal grief sur Trustpilot/Capterra.
2. **UX sur-complexe** : trop d'options, interfaces denses, onboarding inexistant.
3. **Pas de collaboration** : les outils sont mono-utilisateur alors que les agences travaillent en équipe.
4. **Analytics déconnectées** : pas d'export, pas d'intégration Google Analytics native.
5. **Pas de page de destination intégrée** : les utilisateurs doivent rediriger vers leurs propres pages.

**Notre réponse (différenciation) :**
- Les codes dynamiques du plan gratuit ne sont **jamais désactivés**, même après résiliation du plan payant (ils restent éditables mais non trackables).
- **Workspace d'équipe** dès le plan Pro.
- **Landing page builder intégré** : créer une micro-page directement dans l'outil, sans site externe.
- **Export analytics CSV/PDF** sur tous les plans payants.
- **White-label** pour les agences (domaine personnalisé sur le QR redirect).

---

## Contexte

QR Studio est un SaaS de génération et gestion de QR codes dynamiques, ciblant les agences marketing, freelances et PME. Le problème qu'il résout : les outils existants piègent les utilisateurs dans des abonnements (codes désactivés à la résiliation) et manquent de collaboration d'équipe. QR Studio garantit que les codes restent fonctionnels indépendamment du plan souscrit, et intègre un espace de travail multi-utilisateur.

## Périmètre de cette implémentation

**Inclus :**
- Authentification (email/password + Google OAuth)
- Dashboard avec liste des QR codes et métriques clés
- Création de QR codes dynamiques : URL, WhatsApp, WiFi, vCard, PDF, texte brut
- Éditeur visuel QR : couleurs, logo, forme des modules, frame/label
- Redirection dynamique (changer l'URL de destination sans recréer le code)
- Analytics : scans totaux, uniques, par jour/semaine/mois, par pays, par device
- Landing page builder simple (titre, description, bouton CTA, image)
- Export QR : PNG, SVG, PDF
- Workspaces d'équipe avec invitation par email et rôles (Owner, Editor, Viewer)
- Plans tarifaires (Free, Pro 12 $/mois, Agency 39 $/mois) avec Stripe
- API REST publique avec clé API (plan Pro+)
- Génération bulk via CSV upload (plan Pro+)

**Explicitement exclu de cette V1 :**
- A/B testing (prévu V2)
- Geo-targeting avancé (prévu V2)
- Application mobile native
- Intégrations tierces (Zapier, HubSpot)
- QR codes pour App Store / Play Store (deep link)
- Scanner QR intégré

---

## Stack technique

```
- Framework      : Next.js 15 (App Router uniquement, pas Pages Router)
- Langage        : TypeScript strict (noImplicitAny: true, strictNullChecks: true)
- BDD            : PostgreSQL via Prisma 5.x (ORM exclusif, pas de raw SQL sauf annotations)
- API            : tRPC v11 avec Zod v3 pour toute validation d'input
- Auth           : next-auth v5 (providers: credentials + Google)
- UI             : shadcn/ui + Tailwind CSS v3 (pas de Tailwind v4)
- Génération QR  : qrcode.js (npm: qrcode) pour le rendu SVG/Canvas côté serveur
- Upload fichiers: uploadthing (pour logos et PDFs uploadés par l'utilisateur)
- Paiements      : Stripe (checkout sessions + webhooks)
- Email          : Resend (transactionnel uniquement)
- Analytics      : stockage custom en BDD (pas de service tiers en V1)
- Monitoring     : Sentry (erreurs + performance tracing, Vercel integration)
- Géolocalisation: ip-api.com (gratuit, pas de clé requise en V1)
- Tests          : Vitest + Playwright pour les tests E2E critiques
- Déploiement    : Vercel (fonctions Edge pour les redirections QR)
```

## INTERDIT

```
- useEffect pour du data fetching → utiliser React Server Components ou tRPC queries
- any implicite ou explicite → 0 tolérance
- Ajouter une lib non listée sans commentaire // AJOUT: [lib] [raison]
- Laisser des TODO, FIXME, placeholder, "à implémenter plus tard" dans le code final
- Mutations BDD directes dans les composants → passer par les services (src/server/services/)
- Fetch côté client vers /api/... → utiliser tRPC client exclusivement
- Hardcoder des URLs, clés API, ou chaînes de configuration → tout dans .env
- Pages sans métadonnées (title, description) → chaque page a ses generateMetadata()
- Composants > 200 lignes → découper en sous-composants dans [feature]/components/
- useRouter().push() pour les formulaires → utiliser les Server Actions ou les mutations tRPC
```

---

## Architecture fichiers

C'est un Monorepo qu'il faut faire, même architecture répertoire que sur D:\git-projects\Motivygo :

qrstudio-web
qrstudio-desktop (package.json et .gitignore)
qrstudio-mobile (package.json et .gitignore)


```
qrstudio-web : 
src/
  app/
    (auth)/
      login/
        page.tsx                  # Page connexion (email + Google)
      register/
        page.tsx                  # Page inscription
      layout.tsx                  # Layout auth (centré, pas de sidebar)
    (dashboard)/
      layout.tsx                  # Layout dashboard (sidebar + header)
      page.tsx                    # Vue d'ensemble : stats globales + liste QR codes
      qr/
        new/
          page.tsx                # Créateur de QR code (stepper : type → contenu → design → export)
        [id]/
          page.tsx                # Détail d'un QR code (analytics + édition)
          edit/
            page.tsx              # Éditeur visuel du QR code
      team/
        page.tsx                  # Gestion workspace (membres, invitations, rôles)
      billing/
        page.tsx                  # Plans tarifaires + état abonnement Stripe
      settings/
        page.tsx                  # Paramètres compte (profil, mot de passe, clé API)
    api/
      trpc/[trpc]/
        route.ts                  # Handler tRPC (GET + POST)
      webhooks/stripe/
        route.ts                  # Webhook Stripe (checkout.completed, subscription.*)
      qr/[shortCode]/
        route.ts                  # Edge function : redirection dynamique des QR codes
      uploadthing/
        core.ts                   # Config uploadthing
        route.ts                  # Handler uploadthing
  server/
    routers/
      _app.ts                     # Router racine (merge de tous les sous-routers)
      auth.ts                     # Procedures : register, updateProfile, deleteAccount
      qr.ts                       # Procedures : create, update, delete, list, getById, getAnalytics
      team.ts                     # Procedures : invite, removeMember, updateRole, listMembers
      billing.ts                  # Procedures : createCheckoutSession, getSubscription, cancelSubscription
      apiKey.ts                   # Procedures : generate, revoke, list
    services/
      qr.service.ts               # Logique métier QR : génération shortCode, validation, limites plan
      analytics.service.ts        # Enregistrement et agrégation des scans
      redirect.service.ts         # Résolution shortCode → URL destination
      billing.service.ts          # Interaction Stripe, mise à jour plan utilisateur
      email.service.ts            # Envoi emails via Resend (invitation, confirmation)
      team.service.ts             # Logique invitation, permissions, rôles
    db.ts                         # Client Prisma singleton (PrismaClient global)
    auth.ts                       # Config next-auth (providers, callbacks, session strategy)
    trpc.ts                       # Initialisation tRPC (context, middleware auth, middleware plan)
  lib/
    qr-generator.ts               # Wrapper qrcode.js : génère SVG avec options design
    utils.ts                      # cn(), formatDate(), formatNumber(), truncate()
    constants.ts                  # PLAN_LIMITS, QR_TYPES, MAX_FILE_SIZE, SHORT_CODE_LENGTH
    geo.ts                        # Résolution IP → pays via ip-api.com
    validations.ts                # Schémas Zod partagés (emailSchema, urlSchema, shortCodeSchema)
  components/
    ui/                           # Composants shadcn (ne jamais modifier)
    layout/
      sidebar.tsx                 # Sidebar navigation principale
      header.tsx                  # Header avec user menu et workspace switcher
      page-header.tsx             # Titre de page + breadcrumb + actions
    qr/
      qr-creator/
        type-selector.tsx         # Étape 1 : choix du type (URL, WhatsApp, WiFi…)
        content-form.tsx          # Étape 2 : formulaire selon le type
        design-editor.tsx         # Étape 3 : couleurs, logo, forme, frame
        export-panel.tsx          # Étape 4 : téléchargement PNG/SVG/PDF
      qr-preview.tsx              # Rendu live du QR code (canvas)
      qr-card.tsx                 # Carte dans la liste dashboard
      analytics-chart.tsx         # Graphique scans (recharts LineChart)
      scan-map.tsx                # Carte scans par pays (react-simple-maps)
    team/
      member-list.tsx             # Liste membres avec rôles
      invite-form.tsx             # Formulaire invitation email
    billing/
      plan-card.tsx               # Carte plan tarifaire
      usage-meter.tsx             # Jauge utilisation (QR codes, scans)
  hooks/
    use-qr-list.ts                # Hook tRPC query pour la liste QR
    use-analytics.ts              # Hook tRPC query pour les analytics
    use-workspace.ts              # Hook contexte workspace courant
  types/
    index.ts                      # Types partagés (QRType, Plan, Role, ScanData…)
prisma/
  schema.prisma                   # Schéma complet
  migrations/                     # Migrations auto-générées
public/
  qr-frames/                      # SVG frames pour l'éditeur QR
.env.example                      # Toutes les variables requises avec exemples
CLAUDE.md                         # Stack + conventions (pour sessions itératives)
```

---

## Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum Plan {
  FREE
  PRO
  AGENCY
}

enum Role {
  OWNER
  EDITOR
  VIEWER
}

enum QRType {
  URL
  WHATSAPP
  WIFI
  VCARD
  PDF
  TEXT
  LANDING_PAGE
}

enum QRStatus {
  ACTIVE
  PAUSED    // L'utilisateur a manuellement mis en pause (plus de redirect)
  // JAMAIS de status EXPIRED ou DELETED_PLAN — design choice fondamental
}

// ─── Auth ────────────────────────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  passwordHash  String?   // null si OAuth uniquement
  plan          Plan      @default(FREE)
  stripeCustomerId   String?  @unique
  stripeSubscriptionId String? @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  workspaces    WorkspaceMember[]
  ownedWorkspaces Workspace[]
  apiKeys       ApiKey[]

  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Workspace ───────────────────────────────────────────────────────────────

model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique   // ex: "acme-agency"
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner     User              @relation(fields: [ownerId], references: [id])
  members   WorkspaceMember[]
  qrCodes   QRCode[]
  invitations WorkspaceInvitation[]

  @@index([ownerId])
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        Role     @default(VIEWER)
  joinedAt    DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId])
}

model WorkspaceInvitation {
  id          String   @id @default(cuid())
  workspaceId String
  email       String
  role        Role     @default(EDITOR)
  token       String   @unique @default(cuid())
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, email])
  @@index([token])
}

// ─── QR Codes ────────────────────────────────────────────────────────────────

model QRCode {
  id          String   @id @default(cuid())
  workspaceId String
  shortCode   String   @unique   // ex: "abc123" → qrstudio.app/r/abc123
  name        String
  type        QRType
  status      QRStatus @default(ACTIVE)

  // Destination (selon le type)
  destinationUrl  String?   // URL, WhatsApp, PDF
  wifiSsid        String?
  wifiPassword    String?
  wifiEncryption  String?   // WPA, WEP, nopass
  vcardJson       String?   @db.Text  // JSON stringifié du vCard
  textContent     String?   @db.Text
  landingPageId   String?   @unique

  // Design
  fgColor         String    @default("#000000")
  bgColor         String    @default("#FFFFFF")
  logoUrl         String?
  moduleShape     String    @default("square")  // square, rounded, dots
  frameType       String?   // null = pas de frame
  frameLabel      String?

  // Stats dénormalisées (mise à jour async)
  totalScans      Int       @default(0)
  uniqueScans     Int       @default(0)
  lastScannedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  scans       Scan[]
  landingPage LandingPage? @relation(fields: [landingPageId], references: [id])

  @@index([workspaceId])
  @@index([shortCode])
  @@index([createdAt])
}

model LandingPage {
  id          String  @id @default(cuid())
  title       String
  description String? @db.Text
  ctaLabel    String?
  ctaUrl      String?
  imageUrl    String?
  bgColor     String  @default("#FFFFFF")
  textColor   String  @default("#111827")

  qrCode QRCode?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─── Analytics ───────────────────────────────────────────────────────────────

model Scan {
  id          String   @id @default(cuid())
  qrCodeId    String
  scannedAt   DateTime @default(now())

  // Données de contexte
  ipHash      String?  // SHA256(IP) — jamais l'IP brute (RGPD)
  country     String?  // Code ISO-3166 (ex: "FR")
  city        String?
  deviceType  String?  // "mobile", "tablet", "desktop"
  os          String?  // "ios", "android", "windows", "macos", "other"
  browser     String?  // "chrome", "safari", "firefox", "other"
  referer     String?  @db.Text

  qrCode QRCode @relation(fields: [qrCodeId], references: [id], onDelete: Cascade)

  @@index([qrCodeId])
  @@index([qrCodeId, scannedAt])   // Requêtes analytics par période
  @@index([scannedAt])
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

model ApiKey {
  id        String    @id @default(cuid())
  userId    String
  name      String
  keyHash   String    @unique   // SHA256 de la clé — jamais la clé en clair
  keyPrefix String              // 8 premiers chars pour identifier (ex: "qrs_a1b2")
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([keyHash])
}
```

---

## API / Procedures tRPC

### Conventions globales

```typescript
// Contexte disponible dans toutes les procedures
type Context = {
  session: Session | null
  db: PrismaClient
  // Middleware auth injecte aussi :
  user: User           // dans les procedures protectedProcedure
  workspace: Workspace // dans les procedures workspaceProcedure
}

// Middleware auth : vérifie session, lève TRPCError UNAUTHORIZED si absent
// Middleware workspace : vérifie que l'utilisateur est membre du workspace,
//   lève TRPCError FORBIDDEN si role insuffisant
// Middleware plan : vérifie que l'utilisateur a le plan requis
```

---

### auth.register
- **Type :** mutation publique
- **Input :** `{ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) }`
- **Logique :** hasher password avec bcrypt (rounds: 12), créer User, créer Workspace personnel avec slug=cuid(), envoyer email de bienvenue via Resend
- **Output :** `{ userId: string, workspaceId: string }`
- **Erreurs :** `TRPCError CONFLICT` si email déjà utilisé

### auth.updateProfile
- **Type :** mutation protégée
- **Input :** `{ name: z.string().min(2).optional(), image: z.string().url().optional() }`
- **Output :** `{ success: boolean }`

### auth.deleteAccount
- **Type :** mutation protégée
- **Logique :** annuler abonnement Stripe si actif, supprimer l'utilisateur (cascade Prisma efface tout), envoyer email de confirmation
- **Output :** `{ success: boolean }`

---

### qr.list
- **Type :** query protégée + middleware workspace
- **Input :** `{ workspaceId: z.string(), cursor: z.string().optional(), limit: z.number().max(50).default(20), search: z.string().optional(), type: QRTypeSchema.optional() }`
- **Output :** `{ items: QRCodeSummary[], nextCursor: string | undefined, total: number }`
- **Note :** QRCodeSummary = `{ id, shortCode, name, type, status, totalScans, lastScannedAt, createdAt }`

### qr.getById
- **Type :** query protégée + middleware workspace
- **Input :** `{ id: z.string(), workspaceId: z.string() }`
- **Output :** `QRCode` complet avec `landingPage` si applicable
- **Erreurs :** `TRPCError NOT_FOUND` si QR code n'appartient pas au workspace

### qr.create
- **Type :** mutation protégée + middleware workspace + vérification limite plan
- **Input :**
  ```typescript
  z.object({
    workspaceId: z.string(),
    name: z.string().min(1).max(100),
    type: z.enum(['URL','WHATSAPP','WIFI','VCARD','PDF','TEXT','LANDING_PAGE']),
    // Selon le type, exactement un des groupes suivants est requis :
    destinationUrl: z.string().url().optional(),    // URL, WHATSAPP, PDF
    wifi: z.object({ ssid: z.string(), password: z.string().optional(), encryption: z.enum(['WPA','WEP','nopass']) }).optional(),
    vcard: VCardSchema.optional(),                  // voir constants.ts
    textContent: z.string().max(2000).optional(),
    landingPage: LandingPageSchema.optional(),
    // Design (optionnel, defaults dans schema Prisma)
    fgColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    bgColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    logoUrl: z.string().url().optional(),
    moduleShape: z.enum(['square','rounded','dots']).optional(),
    frameType: z.string().optional(),
    frameLabel: z.string().max(50).optional(),
  })
  ```
- **Logique :** générer shortCode unique (6 chars alphanumériques, collision retry x3), appeler qr.service.ts pour générer le SVG initial, sauvegarder en BDD
- **Output :** `{ id: string, shortCode: string, svgContent: string }`
- **Erreurs :** `TRPCError FORBIDDEN` si limite plan atteinte (FREE: 5 QR codes, PRO: 100, AGENCY: illimité)

### qr.update
- **Type :** mutation protégée + middleware workspace (role: EDITOR ou OWNER)
- **Input :** `{ id: z.string(), workspaceId: z.string() }` + mêmes champs optionnels que qr.create
- **Logique :** mettre à jour destination et/ou design, régénérer SVG si design modifié
- **Output :** `{ success: boolean, svgContent: string | undefined }`

### qr.updateStatus
- **Type :** mutation protégée + middleware workspace (role: EDITOR ou OWNER)
- **Input :** `{ id: z.string(), workspaceId: z.string(), status: z.enum(['ACTIVE','PAUSED']) }`
- **Output :** `{ success: boolean }`

### qr.delete
- **Type :** mutation protégée + middleware workspace (role: OWNER)
- **Input :** `{ id: z.string(), workspaceId: z.string() }`
- **Logique :** supprimer QR code + scans en cascade (Prisma), supprimer landingPage associée si présente
- **Output :** `{ success: boolean }`

### qr.getAnalytics
- **Type :** query protégée + middleware workspace
- **Input :** `{ id: z.string(), workspaceId: z.string(), period: z.enum(['7d','30d','90d','all']) }`
- **Output :**
  ```typescript
  {
    totalScans: number,
    uniqueScans: number,
    scansByDay: { date: string, scans: number }[],     // format "YYYY-MM-DD"
    byCountry: { country: string, scans: number }[],   // top 10
    byDevice: { device: string, scans: number }[],
    byOs: { os: string, scans: number }[],
  }
  ```
- **Note :** requête agrégée via Prisma groupBy sur la table Scan

### qr.exportSvg / qr.exportPng
- **Type :** query protégée + middleware workspace
- **Input :** `{ id: z.string(), workspaceId: z.string(), size: z.number().min(100).max(2000).default(400) }`
- **Output :** `{ dataUrl: string }` (base64 PNG ou SVG string)

---

### team.listMembers
- **Type :** query protégée + middleware workspace
- **Input :** `{ workspaceId: z.string() }`
- **Output :** `{ members: { userId, name, email, image, role, joinedAt }[] }`

### team.invite
- **Type :** mutation protégée + middleware workspace (role: OWNER)
- **Input :** `{ workspaceId: z.string(), email: z.string().email(), role: z.enum(['EDITOR','VIEWER']) }`
- **Logique :** créer WorkspaceInvitation (token cuid, expiresAt = now + 7 jours), envoyer email d'invitation via Resend avec lien /invite/[token]
- **Output :** `{ success: boolean }`
- **Erreurs :** `TRPCError CONFLICT` si invitation déjà en cours pour cet email dans ce workspace

### team.acceptInvitation
- **Type :** mutation publique (accessible sans auth pour l'email)
- **Input :** `{ token: z.string() }`
- **Logique :** vérifier token non expiré, créer WorkspaceMember si l'utilisateur existe (sinon rediriger vers register avec email pré-rempli), marquer invitation acceptée
- **Output :** `{ workspaceId: string, workspaceName: string }`
- **Erreurs :** `TRPCError NOT_FOUND` si token invalide, `TRPCError PRECONDITION_FAILED` si expiré

### team.updateMemberRole
- **Type :** mutation protégée + middleware workspace (role: OWNER)
- **Input :** `{ workspaceId: z.string(), userId: z.string(), role: z.enum(['EDITOR','VIEWER']) }`
- **Erreurs :** `TRPCError FORBIDDEN` si tentative de modifier le rôle de l'OWNER

### team.removeMember
- **Type :** mutation protégée + middleware workspace (role: OWNER)
- **Input :** `{ workspaceId: z.string(), userId: z.string() }`
- **Erreurs :** `TRPCError FORBIDDEN` si tentative de supprimer l'OWNER

---

### billing.getSubscription
- **Type :** query protégée
- **Input :** aucun (utilise session.userId)
- **Output :** `{ plan: Plan, status: string, currentPeriodEnd: Date | null, cancelAtPeriodEnd: boolean }`

### billing.createCheckoutSession
- **Type :** mutation protégée
- **Input :** `{ plan: z.enum(['PRO','AGENCY']), successUrl: z.string().url(), cancelUrl: z.string().url() }`
- **Logique :** créer Stripe Checkout Session avec price ID correspondant au plan, passer userId en metadata
- **Output :** `{ checkoutUrl: string }`

### billing.cancelSubscription
- **Type :** mutation protégée
- **Logique :** Stripe `cancelAtPeriodEnd: true` (pas de résiliation immédiate), mettre à jour en BDD
- **Output :** `{ cancelAtPeriodEnd: boolean, currentPeriodEnd: Date }`

---

### apiKey.list
- **Type :** query protégée (plan PRO+)
- **Output :** `{ keys: { id, name, keyPrefix, lastUsedAt, createdAt, revokedAt }[] }`

### apiKey.generate
- **Type :** mutation protégée (plan PRO+)
- **Input :** `{ name: z.string().min(1).max(50) }`
- **Logique :** générer clé `qrs_` + 32 chars aléatoires (crypto.randomBytes), stocker SHA256(clé) + 8 premiers chars comme prefix
- **Output :** `{ key: string }` — **retourner la clé en clair une seule fois, jamais stockée**
- **Erreurs :** `TRPCError FORBIDDEN` si plan FREE

### apiKey.revoke
- **Type :** mutation protégée
- **Input :** `{ id: z.string() }`
- **Logique :** mettre `revokedAt = now()` (soft delete, ne pas supprimer)
- **Output :** `{ success: boolean }`

---

## Endpoint de redirection QR (Edge Function)

```
GET /api/qr/[shortCode]
```

Cet endpoint est une **Next.js Route Handler déployée en Edge Runtime**. C'est le chemin critique — chaque scan passe par là.

**Logique :**
1. Lookup `shortCode` en BDD (Prisma edge-compatible via Accelerate ou requête directe)
2. Si QRCode non trouvé → redirect 301 vers `/404`
3. Si QRCode.status === 'PAUSED' → redirect 301 vers `/qr-paused` (page statique)
4. Enregistrer le scan de façon **asynchrone et non-bloquante** (ne jamais attendre l'écriture analytics pour servir la redirection)
   - Lancer `analytics.service.recordScan()` sans await
   - Incrémenter `totalScans` sur le QRCode (Prisma `updateMany` sans attendre)
5. Résoudre la destination selon le type :
   - URL → `destinationUrl` directement
   - WHATSAPP → `https://wa.me/[numéro]?text=[message encodé]`
   - WIFI → redirect vers `/wifi/[shortCode]` (page HTML avec les credentials WiFi, ne peut pas être une redirection directe)
   - LANDING_PAGE → `/l/[shortCode]` (page rendue côté serveur)
   - VCARD / PDF / TEXT → `/view/[shortCode]`
6. Retourner `redirect(destination, 301)`

**Données de scan à collecter :**
```typescript
{
  qrCodeId: string,
  ipHash: SHA256(request.headers.get('x-forwarded-for') ?? ''),
  country: await geo.getCountry(ip),  // via ip-api.com
  deviceType: parseDevice(userAgent), // 'mobile' | 'tablet' | 'desktop'
  os: parseOs(userAgent),
  browser: parseBrowser(userAgent),
  referer: request.headers.get('referer') ?? null,
}
```

> **⚠️ Runtime de la route de redirection : Prisma Accelerate**
> Prisma Client n'est pas compatible nativement avec Edge Runtime (Vercel Edge Functions).
> **Solution retenue :** Utiliser Prisma Accelerate (`@prisma/extension-accelerate`) avec la
> chaîne de connexion HTTP via `DATABASE_URL_UNPOOLED` pour les requêtes Edge. Ceci permet
> de conserver un démarrage à froid < 50 ms.
>
> *Alternative (non retenue en V1) :* Passer la route en `runtime: 'nodejs'` — plus simple
> mais perd le bénéfice de l'Edge (cold start ~500 ms, latency accrue).
>
> **Configuration requise :**
> - Variable `DATABASE_URL_UNPOOLED` dans le `.env` (fournie par Supabase/Neon)
> - Package `@prisma/extension-accelerate` ajouté aux dépendances
> - Dans le plan Vercel Hobby, Accelerate inclus jusqu'à 1M req/mois

---

## Patterns de code à répliquer

### Pattern Router tRPC (à utiliser pour chaque router)

```typescript
// src/server/routers/qr.ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, workspaceProcedure } from '../trpc'
import { qrService } from '../services/qr.service'

export const qrRouter = router({
  list: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.qRCode.findMany({
        where: { workspaceId: input.workspaceId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      })
      const nextCursor = items.length > input.limit ? items.pop()!.id : undefined
      return { items, nextCursor }
    }),
})
```

### Pattern composant avec mutation tRPC

```typescript
// src/components/qr/delete-qr-button.tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteQRButton({ qrId, workspaceId }: { qrId: string; workspaceId: string }) {
  const utils = api.useUtils()
  const deleteMutation = api.qr.delete.useMutation({
    onSuccess: () => utils.qr.list.invalidate(),
    onError: (err) => console.error('Delete failed:', err.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">Supprimer</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce QR code ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Toutes les analytics associées seront perdues.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate({ id: qrId, workspaceId })}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### Pattern service

```typescript
// src/server/services/qr.service.ts
import { prisma } from '../db'
import { generateQRSvg } from '@/lib/qr-generator'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan, QRType } from '@prisma/client'

export const qrService = {
  async checkPlanLimit(workspaceId: string, ownerPlan: Plan): Promise<void> {
    const limit = PLAN_LIMITS[ownerPlan].maxQRCodes
    if (limit === Infinity) return
    const count = await prisma.qRCode.count({ where: { workspaceId } })
    if (count >= limit) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Limite de ${limit} QR codes atteinte pour votre plan. Passez au plan supérieur.`,
      })
    }
  },

  async generateUniqueShortCode(): Promise<string> {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const existing = await prisma.qRCode.findUnique({ where: { shortCode: code } })
      if (!existing) return code
    }
    throw new Error('Failed to generate unique short code after 3 attempts')
  },
}
```

---

## Phases d'implémentation

> **RÈGLE ABSOLUE :** Ne commence pas une phase tant que `npm run build` ne passe pas sans erreur sur la phase précédente. Chaque phase est un état stable et deployable.

---

### Phase 1 — Infrastructure (fondations)

```
[ ] Initialiser Next.js 15 avec TypeScript strict (npx create-next-app@latest --typescript)
[ ] Configurer tsconfig.json : noImplicitAny, strictNullChecks, paths (@/*)
[ ] Installer et configurer Prisma 5.x avec PostgreSQL
[ ] Écrire le schéma Prisma complet (copier le schéma de ce document)
[ ] Lancer la migration initiale : npx prisma migrate dev --name init
[ ] Configurer next-auth v5 :
    - Provider credentials avec bcrypt
    - Provider Google OAuth
    - Callback session pour inclure userId et plan
    - Stratégie JWT
[ ] Configurer tRPC v11 :
    - src/server/trpc.ts : context, publicProcedure, protectedProcedure
    - src/server/routers/_app.ts : router racine vide
    - src/app/api/trpc/[trpc]/route.ts : handler GET+POST
    - src/lib/trpc/client.ts : client tRPC avec SuperJSON
    - src/lib/trpc/server.ts : caller server-side
[ ] Installer shadcn/ui et initialiser (npx shadcn@latest init)
[ ] Ajouter composants shadcn requis : button, input, form, dialog, alert-dialog,
    select, tabs, badge, card, avatar, dropdown-menu, toast, sheet, separator
[ ] Créer .env.example avec toutes les variables (voir section Variables d'environnement)
[ ] Configurer Prisma Accelerate pour Edge Runtime :
    - Installer @prisma/extension-accelerate
    - Ajouter DATABASE_URL_UNPOOLED dans .env
    - Initialiser Accelerate dans prisma/db.ts (extension sur PrismaClient)
    - Créer un client Prisma dédié pour les Edge Functions (pas de singleton global)
[ ] Installer et configurer Sentry :
    - npx @sentry/wizard@latest -i nextjs (ou config manuelle)
    - Configurer DSN via SENTRY_DSN dans .env
    - Activer le tracing performance (sampleRate: 0.2 en production)
    - Ajouter Sentry.ErrorBoundary dans le layout racine
[ ] Ajouter les scripts npm dans package.json :
    - "typecheck": "tsc --noEmit"
    - "test": "vitest run"
    - "test:watch": "vitest"
    - "test:e2e": "playwright test"
[ ] Vérifier : npm run build + npm run typecheck passent ✓
```

### Phase 2 — Auth & Workspace

```
[ ] Implémenter auth.register (service + router + page /register)
    - Formulaire : name, email, password, confirm password
    - Validation Zod côté client (react-hook-form) et serveur
    - Après inscription : créer workspace personnel automatiquement
    - Redirection post-inscription vers /dashboard
[ ] Implémenter page /login
    - Formulaire email/password
    - Bouton "Continuer avec Google"
    - Lien "Mot de passe oublié" (désactivé en V1, afficher toast "Contactez le support")
    - Redirection post-login vers /dashboard
[ ] Implémenter middleware Next.js (src/middleware.ts) :
    - Routes (dashboard) → redirect /login si non authentifié
    - Routes (auth) → redirect /dashboard si déjà authentifié
    - Route /api/qr/* → ne pas toucher (edge function publique)
[ ] Implémenter layout dashboard (sidebar + header)
    - Sidebar : logo, liens navigation, workspace switcher, user menu
    - Header : titre de la page courante, bouton "Nouveau QR code"
[ ] Créer page /dashboard (stats globales vides pour l'instant)
[ ] Vérifier : npm run build + npm run typecheck passent ✓
```

### Phase 3 — Core QR

```
[ ] Implémenter lib/qr-generator.ts :
    - Fonction generateQRSvg(data: string, options: QRDesignOptions): string
    - Options : fgColor, bgColor, moduleShape, logoUrl (intégré en base64 dans le SVG)
    - Utiliser la lib "qrcode" (import QRCode from 'qrcode')
    - Retourner un SVG string propre
[ ] Implémenter qrService.generateUniqueShortCode()
[ ] Implémenter qrService.checkPlanLimit()
[ ] Implémenter router qr : create, list, getById, update, updateStatus, delete
[ ] Implémenter composant QRCreator (stepper 4 étapes) :
    Étape 1 — Sélection du type :
      - Grille de 7 cartes : URL, WhatsApp, WiFi, vCard, PDF, Texte, Landing Page
      - Chaque carte a une icône, un nom, une courte description
    Étape 2 — Formulaire de contenu (conditionnel selon type) :
      - URL : champ URL avec validation
      - WhatsApp : numéro de téléphone (format international) + message pré-rempli optionnel
      - WiFi : SSID, password, encryption (WPA/WEP/Aucune)
      - vCard : prénom, nom, email, téléphone, entreprise, site web
      - PDF : upload fichier PDF via uploadthing (max 10 MB)
      - Texte : textarea 2000 chars max
      - Landing Page : titre, description, couleur fond, CTA label + URL, image optionnelle
    Étape 3 — Éditeur design :
      - Preview live du QR code (mise à jour à chaque changement)
      - Couleur modules (color picker)
      - Couleur fond (color picker)
      - Forme des modules : square / rounded / dots (3 boutons visuels)
      - Upload logo (via uploadthing, max 500KB, PNG/SVG)
      - Sélection frame : 6 frames prédéfinies (SVG dans public/qr-frames/) ou aucune
      - Label frame (input texte, visible uniquement si frame sélectionnée)
    Étape 4 — Export :
      - Nom du QR code (input, requis)
      - Boutons : Télécharger PNG (400px), Télécharger SVG, Télécharger PDF (A4)
      - Bouton principal : "Créer le QR code" → mutation qr.create → redirect /dashboard/qr/[id]
[ ] Page /dashboard/qr/[id] :
    - Afficher le QR code (SVG) avec boutons download
    - Afficher shortCode et URL de scan : https://[domain]/api/qr/[shortCode]
    - Analytics placeholder (graphiques vides, texte "En attente des premiers scans")
    - Boutons : Éditer destination, Éditer design, Pause/Reprendre, Supprimer
[ ] Implémenter Edge Function /api/qr/[shortCode]/route.ts :
    - Runtime : edge
    - Lookup BDD → redirect dynamique
    - Enregistrement scan asynchrone (sans await)
[ ] Vérifier : npm run build + npm run typecheck passent, créer un QR code URL de bout en bout, scanner, voir le scan comptabilisé ✓
```

### Phase 4 — Analytics

```
[ ] Implémenter analytics.service.recordScan(data: ScanInput): Promise<void>
    - Insérer un Scan en BDD
    - Incrémenter QRCode.totalScans et QRCode.uniqueScans (déduplication par ipHash sur 24h)
    - Mettre à jour QRCode.lastScannedAt
[ ] Implémenter router qr.getAnalytics avec agrégation Prisma
[ ] Page /dashboard/qr/[id] — section analytics :
    - Graphique scans par jour (LineChart recharts) avec sélecteur période 7j/30j/90j
    - Grille 3 colonnes : top pays, répartition devices, répartition OS
    - Chiffres clés : total scans, scans uniques, taux de scan (si applicable)
    - Bouton "Exporter CSV" : générer CSV côté serveur, retourner en download
[ ] Dashboard global /dashboard :
    - Total scans aujourd'hui (somme tous QR codes du workspace)
    - Graphique global scans 7 derniers jours
    - Top 5 QR codes par scans
    - QR codes récemment créés
[ ] Vérifier : npm run build + npm run typecheck passent, analytics affichées correctement après plusieurs scans simulés ✓
```

### Phase 5 — Équipe & Billing

```
[ ] Page /dashboard/team :
    - Liste des membres avec avatar, nom, email, rôle, date d'adhésion
    - Formulaire invitation (email + rôle) avec envoi email
    - Gestion rôles : dropdown pour EDITOR/VIEWER, bouton supprimer
    - Section invitations en attente
[ ] Page /invite/[token] (publique) :
    - Afficher nom du workspace et qui invite
    - Bouton "Accepter" → si authentifié: acceptInvitation → redirect dashboard
    - Si non authentifié : redirect /register?inviteToken=[token]
[ ] Page /dashboard/billing :
    - Plan actuel avec badge
    - Jauges d'utilisation : QR codes (x/5, x/100, illimité), membres équipe
    - 3 cartes plan : Free, Pro 12€/mois, Agency 39€/mois
    - CTA upgrade → createCheckoutSession → redirect Stripe Checkout
    - Si plan payant : date de renouvellement, bouton "Annuler l'abonnement"
[ ] Implémenter webhook Stripe /api/webhooks/stripe :
    - Vérifier signature Stripe (Stripe.constructEvent)
    - checkout.session.completed → mettre à jour User.plan + stripeSubscriptionId
    - customer.subscription.updated → synchro plan
    - customer.subscription.deleted → revenir à FREE (sans désactiver les QR codes !)
[ ] Page /dashboard/settings :
    - Profil : nom, photo (upload via uploadthing)
    - Sécurité : changement mot de passe (vérifier ancien mdp)
    - Clé API (plan PRO+) : bouton "Générer", liste des clés avec prefix, bouton révoquer
    - Zone danger : "Supprimer mon compte"
[ ] Vérifier : npm run build + npm run typecheck passent, flux upgrade → Stripe test → plan mis à jour → limites adaptées ✓
```

### Phase 6 — Polish & Edge Cases

```
[ ] États vides (afficher dans chaque liste/section) :
    - Dashboard sans QR codes : illustration + "Créer votre premier QR code"
    - Analytics sans scans : "En attente des premiers scans. Partagez votre QR code !"
    - Équipe avec un seul membre : "Invitez des collaborateurs"
[ ] Gestion des erreurs utilisateur :
    - Toutes les mutations affichent un Toast d'erreur si TRPCError (composant shadcn Toast)
    - Pages d'erreur : /qr-paused (QR code en pause), /qr-not-found (shortCode invalide)
    - Formulaires : messages d'erreur inline sous chaque champ invalide
[ ] Loading states :
    - Skeleton loader sur la liste des QR codes (shadcn Skeleton)
    - Spinner sur tous les boutons qui déclenchent une mutation pendant isPending
    - Suspense boundaries sur les pages avec data fetching
[ ] Protection des routes équipe :
    - VIEWER ne voit pas les boutons "Inviter" et "Supprimer membre"
    - VIEWER ne peut pas éditer ni supprimer les QR codes (boutons absents + check serveur)
    - Vérifier que le middleware workspace lève bien FORBIDDEN pour les actions non autorisées
[ ] SEO et metadata :
    - Chaque page avec generateMetadata() retournant title et description
    - Page /l/[shortCode] (landing page) avec OG tags basés sur le contenu
[ ] Sécurité :
    - Rate limiting sur /api/qr/[shortCode] : max 100 req/min par IP (middleware Edge)
    - Rate limiting sur auth.register : max 5 tentatives/heure par IP
    - Validation que logoUrl appartient à uploadthing avant de l'accepter
[ ] Performance :
    - Edge function redirection < 50ms (pas de calcul lourd, juste lookup + redirect)
    - Pagination cursor-based sur tous les listings
[ ] Vérifier : npm run build + npm run typecheck passent sans warning ✓

---

### Phase 7 — Tests (unitaires, intégration, E2E)

> Cette phase intervient après tout le développement pour garantir la robustesse
> du produit avant mise en production. Les tests sont exécutés localement et en CI.

```
[ ] Configurer Vitest :
    - Installer vitest, @vitejs/plugin-react, jsdom
    - Créer vitest.config.ts (extends tsconfig paths, jsdom environment)
    - Ajouter script "test": "vitest run" et "test:watch": "vitest" dans package.json
    - Ajouter script "typecheck": "tsc --noEmit" dans package.json (indépendant de build)
[ ] Configurer Playwright :
    - npx playwright install (chromium, firefox, webkit)
    - Créer playwright.config.ts avec baseURL = http://localhost:3000
    - Ajouter script "test:e2e": "playwright test" dans package.json
[ ] Tests unitaires — Services métier :
    - qr.service.ts : generateUniqueShortCode() — vérifier unicité et format
    - qr.service.ts : checkPlanLimit() — FREE/5, PRO/100, AGENCY/∞
    - analytics.service.ts : recordScan() — déduplication par ipHash sur 24h
    - redirect.service.ts : résolution shortCode → destination par type
[ ] Tests unitaires — Utilitaires :
    - lib/qr-generator.ts : generateQRSvg() — vérifier sortie SVG valide
    - lib/validations.ts : chaque schéma Zod — valides + invalides
    - lib/geo.ts : mock ip-api.com, vérifier résolution pays
[ ] Tests d'intégration — tRPC routers :
    - auth.register : succès création utilisateur + workspace, email existant → CONFLICT
    - qr.create : succès, limite plan FREE atteinte → FORBIDDEN
    - qr.create : shortCode unique (3 tentatives de collision simulées)
    - team.invite : OWNER peut inviter, VIEWER → FORBIDDEN
    - billing.createCheckoutSession : génère URL Stripe valide
    - apiKey.generate : plan FREE → FORBIDDEN, clé retournée une seule fois
[ ] Tests E2E critiques (Playwright) :
    - Inscription → création workspace → redirection dashboard
    - Login email/password → session active → redirection dashboard
    - Créer QR code URL → vérifier affichage dans la liste
    - Modifier destination d'un QR code → vérifier mise à jour
    - Inviter un membre → vérifier email envoyé (mock Resend)
    - Upgrade plan → Stripe Checkout simulé → plan mis à jour
[ ] Couverture minimale :
    - Services : 80%+ de coverage
    - Routers tRPC : chaque procédure testée (succès + chaque code d'erreur)
    - Composants critiques : QRCreator, DeleteQRButton (interactions utilisateur)
[ ] Vérifier : npm run test passe, npm run test:e2e passe (headless), npm run build + npm run typecheck passent ✓
```

---

## Variables d'environnement

```bash
# .env.example

# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/qrstudio"
DATABASE_URL_UNPOOLED="postgresql://user:password@localhost:5432/qrstudio"  # Pour Prisma Accelerate (Edge Runtime)

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

# Stripe
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
STRIPE_PRO_PRICE_ID="price_xxx"      # Plan Pro 12€/mois
STRIPE_AGENCY_PRICE_ID="price_xxx"   # Plan Agency 39€/mois
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxx"

# Resend (email)
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@qrstudio.app"

# Uploadthing (uploads logos et PDFs)
UPLOADTHING_SECRET="sk_live_xxx"
UPLOADTHING_APP_ID="xxx"

# Sentry (monitoring erreurs et performance)
SENTRY_DSN="https://xxx@oxxx.ingest.sentry.io/xxx"
SENTRY_ORG="qr-studio"
SENTRY_PROJECT="qrstudio-web"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="QR Studio"
```

---

## Constantes de plan (src/lib/constants.ts)

```typescript
export const PLAN_LIMITS = {
  FREE: {
    maxQRCodes: 5,
    maxTeamMembers: 1,        // Solo uniquement
    analyticsRetentionDays: 30,
    bulkGeneration: false,
    apiAccess: false,
    customDomain: false,
  },
  PRO: {
    maxQRCodes: 100,
    maxTeamMembers: 5,
    analyticsRetentionDays: 365,
    bulkGeneration: true,
    apiAccess: true,
    customDomain: false,
  },
  AGENCY: {
    maxQRCodes: Infinity,
    maxTeamMembers: Infinity,
    analyticsRetentionDays: Infinity,
    bulkGeneration: true,
    apiAccess: true,
    customDomain: true,        // Prévu V2 mais flag dès maintenant
  },
} as const satisfies Record<Plan, PlanLimits>

// IMPORTANT : les codes FREE ne sont JAMAIS désactivés à la résiliation.
// Un utilisateur qui passe de PRO à FREE conserve ses QR codes existants actifs
// mais ne peut plus en créer de nouveaux au-delà de 5.
// C'est la promesse centrale de QR Studio.
```

---

## Critères de done

Le projet est terminé **uniquement** quand :

**Build & types**
```
[ ] npm run build passe sans erreur ni warning
[ ] npm run typecheck (tsc --noEmit) passe
[ ] npm run test passe (Vitest — unitaires + intégration)
[ ] npm run test:e2e passe (Playwright — headless)
[ ] Aucun any explicite ou implicite dans le code
[ ] Aucun TODO, FIXME, placeholder, fonction vide ou stub dans le code final
[ ] Sentry configuré et opérationnel (vérifier source map upload en CI)
[ ] Prisma Accelerate fonctionnel sur la route Edge /api/qr/[shortCode]
```

**Flux critiques vérifiés manuellement**
```
[ ] Inscription → création workspace → redirection dashboard
[ ] Login email/password → session active → redirection dashboard
[ ] Login Google OAuth → session active → redirection dashboard
[ ] Créer QR code URL → scanner → voir le scan comptabilisé dans les analytics
[ ] Modifier la destination d'un QR code → rescanner → nouvelle destination
[ ] Mettre en pause un QR code → scanner → page /qr-paused
[ ] Inviter un membre → email reçu → acceptation → membre visible dans l'équipe
[ ] Upgrade plan → Stripe Checkout test → plan mis à jour → nouvelles limites actives
[ ] Annuler abonnement → plan reste actif jusqu'à fin de période → repasse FREE sans casser les QR codes
[ ] Plan FREE avec 5 QR codes → tentative de créer le 6ème → message d'erreur clair avec CTA upgrade
[ ] Générer clé API (plan PRO) → utiliser dans curl → QR code créé via API
```

**Sécurité**
```
[ ] Routes dashboard inaccessibles sans authentification (test navigation directe URL)
[ ] VIEWER ne peut pas exécuter les mutations EDITOR/OWNER (test via tRPC client)
[ ] Webhook Stripe vérifie la signature (ne pas accepter de faux webhooks)
[ ] Aucune clé API stockée en clair en BDD
[ ] IPs de scan stockées hashées (SHA256), jamais en clair
```

**UX**
```
[ ] Tous les boutons de mutation affichent un état "chargement" pendant isPending
[ ] Tous les états vides ont un message et un appel à l'action
[ ] Toutes les erreurs serveur affichent un Toast lisible par l'utilisateur
[ ] .env.example contient toutes les variables avec des exemples non-sensibles
```

---

## CLAUDE.md (placer à la racine du projet)

> Ce fichier est lu automatiquement par Claude Code à chaque session.

```markdown
# QR Studio — Conventions

## Stack
- Next.js 15 App Router + TypeScript strict
- tRPC v11 + Zod v3
- Prisma 5.x + PostgreSQL (Prisma Accelerate pour Edge Runtime)
- next-auth v5
- shadcn/ui + Tailwind CSS v3
- Sentry (monitoring erreurs + performance)
- Vitest (tests unitaires) + Playwright (tests E2E)

## Règles absolues
- Zéro `any` implicite ou explicite
- Data fetching : React Server Components ou tRPC queries (jamais useEffect fetch)
- Mutations BDD : passer par src/server/services/ (jamais direct dans les routes)
- Client API : tRPC client exclusivement (jamais fetch /api/...)
- Composants > 200 lignes → découper
- Pas de TODO, FIXME, placeholder dans le code mergé
- `npm run typecheck` doit passer avant tout commit (lint-staged si possible)

## Tests
- Exécuter `npm run test` avant tout commit
- Les tests E2E Playwright sont dans `tests/` à la racine
- Coverage minimale : 80% sur les services, 100% des codes d'erreur tRPC
- Ne jamais merger une PR sans que tous les tests passent en CI

## Architecture
- Routers tRPC : src/server/routers/[domaine].ts
- Services métier : src/server/services/[domaine].service.ts
- Composants feature : src/components/[feature]/
- Types partagés : src/types/index.ts
- Constantes plan : src/lib/constants.ts (PLAN_LIMITS)

## Design décision clé
Les QR codes FREE ne sont JAMAIS désactivés. Même après résiliation d'un plan payant,
les codes restent ACTIFS (mais non trackés au-delà de la rétention du plan).
Ne jamais ajouter de logique qui désactive des codes à la résiliation.
```
