# Feature Specifications : MFA/TOTP (4.5) & Soft-delete QR codes (4.7)

---

## 1. MFA/TOTP — Authentification Multi-Facteurs (4.5)

**Effort** : M (1-2 semaines)
**Priorité** : 🟠 Haute (sécurité)
**Dépendances** : Aucune

### 1.1 Objectif

Permettre aux utilisateurs d'activer une validation en deux étapes (2FA) via une application d'authentification (Google Authenticator, Authy, 1Password, etc.) basée sur TOTP (Time-based One-Time Password).

### 1.2 Flux utilisateur

```
Login (email + mdp)
  │
  ├─ Si TOTP désactivé → Dashboard
  │
  └─ Si TOTP activé → Page challenge TOTP (6 chiffres)
       │
       ├─ Code valide → Dashboard (JWT marqué totpVerified)
       │
       └─ Code invalide → Erreur "Code invalide", 5 erreurs → lockout 15min

Settings → Sécurité
  │
  ├─ Activer 2FA
  │    ├─ Génération secret → Affichage QR code
  │    ├─ Saisie code de confirmation
  │    └─ 8 backup codes à usage unique affichés + téléchargeables
  │
  └─ Désactiver 2FA
       └─ Confirmation par mot de passe ou code TOTP
```

### 1.3 Schéma Prisma

```prisma
// Ajouts sur le modèle User existant
model User {
  // ... champs existants ...

  totpSecret      String?   // TOTP secret (chiffré ou en clair — clair OK car DB est privée)
  totpEnabled     Boolean   @default(false)
  totpBackupCodes Json?     @db.JsonB  // [{ code_hash, used: boolean }, ...]
  totpVerifiedAt  DateTime? // Dernière vérification TOTP réussie
}
```

### 1.4 Librairies

| Package | Raison |
|---|---|
| `otplib` | Génération et vérification TOTP (standard RFC 6238) |
| `qrcode` | Génération du QR code à scanner (version server-side, pas de composant React lourd) |

Pas de nouvelle infrastructure. TOTP est entièrement stateless côté serveur (juste un secret + horloge).

### 1.5 Architecture détaillée

#### 1.5.1 NextAuth — SignIn Callback

Le fichier `src/server/auth.ts` doit être modifié pour ajouter un hook `signIn` :

```typescript
// Dans authorize callback (Credentials)
const user = await prisma.user.findUnique({ where: { email } })
if (!user || !user.passwordHash) return null

const valid = await bcrypt.compare(password, user.passwordHash)
if (!valid) return null

// Si TOTP activé, ne PAS finaliser le login — retourner un token partiel
if (user.totpEnabled) {
  // Créer un token temporaire (valide 5 min) qui prouve "email+password OK"
  const partialToken = await createPartialAuthToken(user.id)
  return { id: user.id, email: user.email, partialToken, needsTotp: true }
}

// Si TOTP désactivé, login normal
return { id: user.id, email: user.email, name: user.name, image: user.image, plan: user.plan }
```

#### 1.5.2 Partial Auth Token

Stocké en mémoire (pas de DB) via un Map ou une table temporaire :

```typescript
// Cache simple pour les tokens partiels (TTL 5 min)
const partialAuthCache = new Map<string, { userId: string; expiresAt: Date }>()

function createPartialAuthToken(userId: string): string {
  const token = crypto.randomUUID()
  partialAuthCache.set(token, {
    userId,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })
  return token
}

function consumePartialAuthToken(token: string): string | null {
  const entry = partialAuthCache.get(token)
  if (!entry || entry.expiresAt < new Date()) {
    partialAuthCache.delete(token)
    return null
  }
  partialAuthCache.delete(token)
  return entry.userId
}
```

Alternative plus robuste : utiliser un JWT signé avec une courte durée (5 min) et un `jti` unique.

#### 1.5.3 Pages

**`src/app/auth/totp/page.tsx`** — Page de challenge TOTP
- Affiche un input pour les 6 chiffres
- Submit → POST vers `api/auth/totp` ou tRPC `auth.verifyTotp`
- Si valide → Nettoie le token partiel, crée la session complète via `signIn("credentials", { ..., totpToken })`
- Si invalide → Message d'erreur, compteur de tentatives

**`src/app/(dashboard)/settings/security/page.tsx`** — Page de configuration 2FA
- Onglet "Sécurité" dans les settings
- État actuel : "2FA désactivé" ou "2FA activé depuis le DD/MM/YYYY"
- Bouton "Activer" → QR code + confirmation
- Bouton "Désactiver" → confirmation par mot de passe

#### 1.5.4 tRPC Procedures

**Router `src/server/routers/auth.ts`** — Nouvelles procedures :

```typescript
// Générer un secret TOTP et retourner le QR code (data:image)
auth.generateTotpSetup: protectedProcedure
  .query(async ({ ctx }) => {
    // Génère un secret via otplib
    // Sauvegarde temporairement dans User.totpSecret (pas encore activé)
    // Retourne { secret: "JBSWY3DPEHPK3PXP", qrCode: "data:image/png;base64,...", uri: "otpauth://..." }
  })

// Confirmer l'activation en vérifiant un premier code
auth.verifyAndEnableTotp: protectedProcedure
  .input(z.object({ token: z.string().length(6) }))
  .mutation(async ({ ctx, input }) => {
    // Vérifie le code avec le secret stocké
    // Si OK → totpEnabled = true, génère 8 backup codes
    // Retourne les backup codes
  })

// Vérifier un code TOTP (login challenge)
auth.verifyTotpChallenge: publicProcedure
  .input(z.object({ partialToken: z.string(), token: z.string().length(6) }))
  .mutation(async ({ ctx, input }) => {
    // Consomme le partialToken → récupère userId
    // Vérifie le code TOTP
    // Si OK → signIn avec credentials + userId
  })

// Désactiver TOTP
auth.disableTotp: protectedProcedure
  .input(z.object({ password: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Vérifie le mot de passe
    // Supprime totpSecret, totpEnabled = false
  })

// Utiliser un backup code
auth.useBackupCode: publicProcedure
  .input(z.object({ partialToken: z.string(), backupCode: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Vérifie le backup code (hash)
    // Marque comme utilisé
    // Si plus de backup codes → désactiver TOTP (forcer re-setup)
  })
```

#### 1.5.5 Integration Google OAuth

Pour les utilisateurs Google OAuth, le MFA n'est pas nécessaire car Google gère déjà sa propre 2FA. Mais on peut offrir une option "forcer le MFA pour tous" dans les settings si souhaité.

**Décision** : Ne pas forcer le MFA pour les connexions OAuth (Google gère déjà). Optionnel via settings.

#### 1.5.6 Session JWT

```typescript
// Dans jwt callback
token.totpVerified = true  // Après vérification TOTP réussie

// Dans session callback
session.user.totpEnabled = user.totpEnabled
```

### 1.6 Fichiers modifiés/créés

| Fichier | Action | Changement |
|---|---|---|
| `prisma/schema.prisma` | Modifié | +totpSecret, +totpEnabled, +totpBackupCodes, +totpVerifiedAt |
| `prisma/migrations/*_add_totp` | Créé | Migration SQL |
| `src/server/auth.ts` | Modifié | +partial auth token logic, +signIn callback, +JWT callbacks |
| `src/server/services/auth.service.ts` | Modifié | +generateTotpSetup, +verifyAndEnableTotp, +verifyTotpChallenge, +disableTotp, +useBackupCode |
| `src/server/routers/auth.ts` | Modifié | +5 nouvelles procedures tRPC |
| `src/app/auth/totp/page.tsx` | Créé | Page challenge TOTP (6 chiffres) |
| `src/app/(dashboard)/settings/security/page.tsx` | Créé | Page configuration 2FA |
| `src/components/auth/totp-setup-dialog.tsx` | Créé | Dialog QR code + confirmation |
| `src/components/auth/totp-input.tsx` | Créé | Composant input 6 chiffres |
| `package.json` | Modifié | +otplib, +qrcode |
| `tests/unit/services/auth.service.test.ts` | Modifié | +15-20 tests TOTP |
| `tests/integration/routers/auth.test.ts` | Modifié | +tests integration TOTP |

### 1.7 Sécurité

- **Secret TOTP** : Stocké en clair dans la DB (PostgreSQL est chiffrée au repos). Alternative : chiffrer avec une clé dédiée (AES-256-GCM) avant stockage.
- **Backup codes** : Hashés avec bcrypt avant stockage (comme les passwords). 8 codes, usage unique.
- **Rate limiting** : 5 tentatives TOTP échouées → lockout 15 min (réutiliser le mécanisme existant `loginAttempts` / `lockoutUntil`).
- **Partial token** : JWT signé avec `NEXTAUTH_SECRET`, durée 5 min, usage unique.
- **Bruteforce** : Impossible — le secret change à chaque activation et le code expire après 30s.

### 1.8 Tests

| Test | Type | Description |
|---|---|---|
| generateTotpSetup retourne secret + QR | Unité | Vérifie le format de sortie |
| verifyAndEnableTotp avec code valide | Unité | Active TOTP, retourne backup codes |
| verifyAndEnableTotp avec code invalide | Unité | Erreur, pas d'activation |
| verifyTotpChallenge avec token valide | Unité | Login complet |
| verifyTotpChallenge avec token expiré | Unité | Erreur |
| disableTotp avec bon mot de passe | Unité | Désactive |
| disableTotp avec mauvais mot de passe | Unité | Erreur |
| backup code valide login | Unité | Login avec backup code |
| backup code déjà utilisé | Unité | Erreur |
| 5 tentatives échouées → lockout | Unité | Lockout |
| Connexion Google OAuth ignore TOTP | Intégration | Pas de challenge |
| Backup codes hashés en DB | Unité | Vérifie que le clair n'est pas stocké |
| totpSecret supprimé après désactivation | Unité | Vérifie clean state |

---

## 2. Soft-delete QR codes (4.7)

**Effort** : M (1-2 semaines)
**Priorité** : 🟠 Haute (data safety)
**Dépendances** : Aucune

### 2.1 Objectif

Remplacer la suppression immédiate (hard delete) par une mise en corbeille avec possibilité de restauration. Les QR codes supprimés sont définitivement effacés après une période configurable selon le plan.

### 2.2 Flux utilisateur

```
État normal
  QR code ACTIF ──(clic Supprimer)──→ Corbeille

Corbeille (30 jours max)
  QR code CORBEILLE ──(Restaurer)──→ ACTIF
  QR code CORBEILLE ──(Suppr. déf.)──→ Hard delete (permanent)

Nettoyage automatique (worker quotidien)
  QR code en corbeille depuis > 30j → Hard delete permanent
  
Impact sur les limites
  checkPlanLimit ignore les codes en corbeille
  → 5/5 codes utilisés, supprimer 2 → 3/5 utilisés, 2 en corbeille

Impact sur les redirections
  QR code en corbeille → redirige vers /qr-deleted (page d'information)
```

### 2.3 Schéma Prisma

```prisma
// Ajout sur le modèle QRCode existant
model QRCode {
  // ... tous les champs existants ...

  deletedAt DateTime?  // NULL = pas supprimé, date = mis en corbeille à cette date
}

// L'enum QRStatus peut être conservé tel quel (ACTIVE, PAUSED)
// On utilise deletedAt comme indicateur, pas un statut séparé
```

**Pourquoi un champ `deletedAt` plutôt qu'un statut `DELETED` ?**
- On peut dater la mise en corbeille (nécessaire pour le cleanup automatique)
- On garde `ACTIVE`/`PAUSED` pour le statut fonctionnel du QR code
- Pas de modification de l'enum existante (moins de changements cassants)
- La requête `list` filtre simplement `WHERE deletedAt IS NULL`

### 2.4 Architecture détaillée

#### 2.4.1 QR Service — Nouvelles méthodes

```typescript
// src/server/services/qr.service.ts

async softDelete(id: string, workspaceId: string): Promise<void> {
  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId },
  })
  if (!qrCode) throw new TRPCError({ code: 'NOT_FOUND' })
  if (qrCode.deletedAt) return // déjà en corbeille

  await prisma.qRCode.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

async restore(id: string, workspaceId: string): Promise<void> {
  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId, deletedAt: { not: null } },
  })
  if (!qrCode) throw new TRPCError({ code: 'NOT_FOUND' })

  await prisma.qRCode.update({
    where: { id },
    data: { deletedAt: null },
  })
}

async permanentDelete(id: string, workspaceId: string): Promise<void> {
  const qrCode = await prisma.qRCode.findFirst({
    where: { id, workspaceId },
  })
  if (!qrCode) throw new TRPCError({ code: 'NOT_FOUND' })

  await prisma.qRCode.delete({ where: { id } })
}

// Modification de checkPlanLimit pour exclure les soft-deleted
async checkPlanLimit(workspaceId: string, ownerPlan: Plan): Promise<void> {
  const planKey = ownerPlan as PlanKey
  const limit = PLAN_LIMITS[planKey].maxQRCodes
  if (limit === Infinity) return
  const count = await prisma.qRCode.count({
    where: { workspaceId, deletedAt: null },
  })
  if (count >= limit) {
    throw new TRPCError({ ... })
  }
}
```

#### 2.4.2 QR Router — Modifications

```typescript
// src/server/routers/qr.ts

// Procedure list — ajouter filtre deletedAt
list: workspaceProcedure
  .input(z.object({
    workspaceId: z.string(),
    type: QRTypeEnum.optional(),
    status: QRStatusEnum.optional(),
    search: z.string().optional(),
    trash: z.boolean().optional().default(false), // NOUVEAU
    limit: z.number().min(1).max(100).default(20),
    cursor: z.string().optional(),
  }))
  .query(async ({ ctx, input }) => {
    await workspaceQuery(ctx, input.workspaceId)
    const where: Prisma.QRCodeWhereInput = { workspaceId: input.workspaceId }

    // Filtrer corbeille ou actifs
    if (input.trash) {
      where.deletedAt = { not: null }
    } else {
      where.deletedAt = null
    }

    // ... reste inchangé (filtres type, status, search, pagination)
  })

// Procedure delete → remplacée par softDelete
delete: workspaceProcedure
  .input(z.object({ id: z.string(), workspaceId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await qrService.softDelete(input.id, input.workspaceId)
  })

// NOUVELLE procedure restore
restore: workspaceProcedure
  .input(z.object({ id: z.string(), workspaceId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await qrService.restore(input.id, input.workspaceId)
  })

// NOUVELLE procedure permanentDelete
permanentDelete: workspaceProcedure
  .input(z.object({ id: z.string(), workspaceId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await qrService.permanentDelete(input.id, input.workspaceId)
  })
```

#### 2.4.3 Redirect — QR codes en corbeille

```typescript
// src/server/services/redirect.service.ts

export function resolveDestination(qrCode: QRCodeRecord): string {
  // NOUVEAU : Si le QR code est en corbeille → page d'info
  if (qrCode.deletedAt) {
    return `/qr-deleted`
  }
  // ... suite inchangée ...
}

// QRCodeRecord interface — ajouter deletedAt
export interface QRCodeRecord {
  shortCode: string
  type: QRType
  status: QRStatus
  metadata: unknown
  deletedAt: Date | null  // NOUVEAU
}
```

#### 2.4.4 Cleanup Worker

```typescript
// src/server/workers/cleanup-trash.worker.ts

// Worker PgBoss quotidien (singleton, 03:00)
// Plan FREE → corbeille vidée après 7 jours
// Plan PRO → corbeille vidée après 30 jours
// Plan AGENCY → corbeille vidée après 90 jours

async function cleanupTrash() {
  const plans = [
    { plan: 'FREE', retentionDays: 7 },
    { plan: 'PRO', retentionDays: 30 },
    { plan: 'AGENCY', retentionDays: 90 },
  ]

  for (const { plan, retentionDays } of plans) {
    const cutoff = new Date(Date.now() - retentionDays * 86400_000)
    await prisma.qRCode.deleteMany({
      where: {
        deletedAt: { lte: cutoff },
        workspace: { owner: { plan: plan as Plan } },
      },
    })
  }
}
```

#### 2.4.5 Interface utilisateur

**Filtre corbeille** — `qr-list-filters.tsx`

```typescript
// Ajouter un toggle/bouton "Corbeille" dans les filtres
// Quand actif, la liste affiche les QR codes avec deletedAt != null
// Style : opacité réduite, badge "Supprimé le DD/MM"
```

**QR Card** — `qr-card.tsx`

```typescript
// Si le QR code est en corbeille (deletedAt present) :
//   - Style grisé / opacité réduite
//   - Menu : "Restaurer", "Supprimer définitivement"
//   - Pas de lien vers la page d'édition
//   - Badge : "Corbeille"
// Sinon (ACTIF/PAUSED) :
//   - Menu : "Modifier", "Mettre en pause", "Supprimer" (→ corbeille)
```

**Pages à créer** — `src/app/qr-deleted/page.tsx`

```typescript
// Page simple expliquant que le QR code a été supprimé
// "Ce QR code n'est plus actif. Contactez le propriétaire pour plus d'informations."
```

#### 2.4.6 Menu utilisateur — Animation undo

```typescript
// Quand l'utilisateur clique "Supprimer" :
// 1. Appel softDelete immédiat
// 2. Toast "Déplacé vers la corbeille" avec bouton "Annuler"
// 3. Annuler → restore (5 secondes)
// 4. Après 5s, le toast disparaît
```

### 2.5 Fichiers modifiés/créés

| Fichier | Action | Changement |
|---|---|---|
| `prisma/schema.prisma` | Modifié | +deletedAt DateTime? sur QRCode |
| `prisma/migrations/*_add_deleted_at` | Créé | Migration SQL |
| `src/server/services/qr.service.ts` | Modifié | +softDelete, +restore, +permanentDelete, +checkPlanLimit modifié |
| `src/server/services/redirect.service.ts` | Modifié | +deletedAt check, +QRCodeRecord.deletedAt |
| `src/server/routers/qr.ts` | Modifié | +restore, +permanentDelete, +trash filter sur list |
| `src/server/workers/cleanup-trash.worker.ts` | Créé | Worker PgBoss quotidien |
| `src/server/queue.ts` | Modifié | +CLEANUP_TRASH queue name |
| `src/instrumentation.ts` | Modifié | +démarrage cleanup worker |
| `src/app/qr-deleted/page.tsx` | Créé | Page statique "QR code supprimé" |
| `src/app/api/qr/[shortCode]/route.ts` | Modifié | +passe deletedAt à resolveDestination |
| `src/components/qr/qr-card.tsx` | Modifié | +état corbeille, +restaurer |
| `src/components/qr/qr-list-filters.tsx` | Modifié | +filtre corbeille |
| `src/hooks/use-qr-list.ts` | Modifié | +trash param optionnel |
| `src/app/(dashboard)/qr-codes/qr-code-list-client.tsx` | Modifié | +undo toast, +gestion corbeille |
| `tests/unit/services/qr.service.test.ts` | Modifié | +tests softDelete, restore, checkPlanLimit |
| `tests/unit/services/redirect.service.test.ts` | Modifié | +test redirection corbeille |
| `tests/integration/routers/qr.test.ts` | Modifié | +tests restore, permanentDelete, trash list |
| `tests/unit/services/cleanup-trash.test.ts` | Créé | Tests cleanup worker |

### 2.6 Tests

| Test | Type | Description |
|---|---|---|
| softDelete marque deletedAt | Unité | Vérifie la date |
| softDelete deux fois idempotent | Unité | Pas d'erreur |
| restore enlève deletedAt | Unité | deletedAt = null |
| restore sur code non supprimé | Unité | Erreur NOT_FOUND |
| permanentDelete efface vraiment | Unité | hard delete |
| checkPlanLimit ignore corbeille | Unité | Compte seulement deletedAt: null |
| List sans trash exclut corbeille | Intégration | WHERE deletedAt IS NULL |
| List avec trash montre corbeille | Intégration | WHERE deletedAt IS NOT NULL |
| Redirect vers /qr-deleted si corbeille | Unité | Vérifie URL |
| Redirect normal si ACTIF | Unité | Inchangé |
| Cleanup worker FREE 7j | Unité | Supprime après 7j |
| Cleanup worker PRO 30j | Unité | Supprime après 30j |
| Cleanup worker ne touche pas ACTIF | Unité | deletedAt: null intacts |
| Undo toast restore | Intégration | Appel restore dans les 5s |

### 2.7 Sécurité

- **Soft-delete** : Seul le propriétaire (ou OWNER) peut soft-delete, restore, ou permanentDelete
- **Permanent delete** : Vérifie workspaceId + rôle propriétaire
- **Redirection** : Un QR code en corbeille ne redirige pas vers une destination arbitraire
- **Cleanup worker** : Ne supprime que les QR codes dont le propriétaire a le bon plan

---

## 3. Ordre d'implémentation recommandé

```
Semaine 1 : Soft-delete (4.7) — plus simple, valeur immédiate, prépare le terrain
  ├─ Jour 1-2 : Prisma + migration + service (softDelete, restore, checkPlanLimit)
  ├─ Jour 2-3 : Router + redirect + edge route
  ├─ Jour 3-4 : Client (filtres, card, undo toast, page deleted)
  ├─ Jour 4-5 : Cleanup worker + tests
  └─ Jour 5   : Review + fix

Semaine 2 : MFA/TOTP (4.5) — plus complexe, nécessite NextAuth
  ├─ Jour 1   : Prisma + migration + librairies
  ├─ Jour 2   : auth.service.ts (TOTP generation, verify, backup codes)
  ├─ Jour 3   : auth.ts NextAuth (partial token, signIn callback, JWT)
  ├─ Jour 4   : Pages (challenge, settings) + composants
  └─ Jour 5   : Tests + review + fix
```

---

*Document généré le 05/06/2026*
