# 🛠️ Plan d'Implémentation — QR Studio

> **Basé sur :** `REVIEW.md` (revue complète par 24 agents spécialisés)
> **Périmètre :** Sprints 1 à 3 + Horizon 6 mois — 32 actions
> **Projet :** QR Studio — SaaS de génération et gestion de QR codes dynamiques
> **Stack :** Next.js 15, TypeScript strict, tRPC v11, Prisma 5/PostgreSQL, NextAuth v5, shadcn/ui

---

## Table des matières

- [Conventions générales](#conventions-générales)
- [Sprint 1 — Correctifs critiques (semaine 1-2)](#sprint-1--correctifs-critiques-semaine-1-2)
  - [1.1 Implémenter la page liste QR codes](#11-implémenter-la-page-liste-qr-codes)
  - [1.2 Câbler les exports PNG/SVG/PDF dans QRCreator](#12-câbler-les-exports-pngsvgpdf-dans-qrcreator)
  - [1.3 Ajouter cascade delete Workspace.owner et LandingPage](#13-ajouter-cascade-delete-sur-workspaceowner-et-qrcodelandingpage)
  - [1.4 Supprimer la duplication buildQRData](#14-supprimer-la-duplication-buildqrdata-router--service)
  - [1.5 Ajouter onDelete:Cascade + PK VerificationToken](#15-ajouter-ondelete-cascade-et-corriger-verificationtoken-pk)
  - [1.6 Corriger le bug subscription.updated webhook Stripe](#16-corriger-le-bug-subscriptionupdated-webhook-stripe)
  - [1.7 Corriger la double sanitization WHATSAPP](#17-corriger-la-double-sanitization-whatsapp)
  - [1.8 Supprimer le Dialog imbriqué ApiKeyManager](#18-supprimer-le-dialog-imbriqué-apikeymanager)
- [Sprint 2 — Stabilisation (semaine 3-6)](#sprint-2--stabilisation-semaine-3-6)
  - [2.1 Migrer le rate limiting vers Redis](#21-migrer-le-rate-limiting-vers-redisupstash)
  - [2.2 Ajouter l'idempotency sur le webhook Stripe](#22-ajouter-lidempotency-sur-le-webhook-stripe)
  - [2.3 Rendre recordScan asynchrone](#23-rendre-recordscan-asynchrone)
  - [2.4 Implémenter l'agrégation SQL pour l'analytics](#24-implémenter-lagrégation-sql-pour-getscansbyday-et-dashboard)
  - [2.5 Ajouter les index composites manquants](#25-ajouter-les-index-composites-manquants)
  - [2.6 Ajouter un verrouillage de compte](#26-ajouter-un-verrouillage-de-compte)
  - [2.7 Bloquer PAUSED pour les utilisateurs FREE](#27-bloquer-le-statut-paused-pour-les-utilisateurs-free)
  - [2.8 Appliquer la rétention analytics](#28-appliquer-la-rétention-analytics)
- [Sprint 3 — Amélioration (mois 2-3)](#sprint-3--amélioration-mois-2-3)
  - [3.1 Extraire computeQRData dans un utilitaire partagé](#31-extraire-computeqrdata-dans-un-utilitaire-partagé)
  - [3.2 Supprimer les couleurs hardcodées](#32-supprimer-les-couleurs-hardcodées)
  - [3.3 Ajouter retry et timeout sur appels externes](#33-ajouter-retry--timeout-sur-les-appels-externes)
  - [3.4 Rendre la géolocalisation IP asynchrone](#34-rendre-la-géolocalisation-ip-asynchrone)
  - [3.5 Ajouter un health check endpoint](#35-ajouter-un-health-check-endpoint)
  - [3.6 Mettre en place un logger structuré](#36-mettre-en-place-un-logger-structuré)
  - [3.7 Ajouter les contraintes de longueur sur les colonnes](#37-ajouter-les-contraintes-de-longueur-sur-les-colonnes)
  - [3.8 Envelopper recordScan et acceptInvitation dans des transactions](#38-envelopper-recordscan-et-acceptinvitation-dans-des-transactions)
  - [3.9 Ajouter un index sur LandingPage.createdAt](#39-ajouter-un-index-sur-landingpagecreatedat)
- [Horizon 6 mois — Évolution](#horizon-6-mois--évolution)
  - [4.1 Refondre le pipeline analytics](#41-refondre-le-pipeline-analytics)
  - [4.2 Partitionner la table Scan par mois](#42-partitionner-la-table-scan-par-mois)
  - [4.3 Migrer QRCode vers JSONB](#43-migrer-les-colonnes-type-dépendantes-qrcode-vers-jsonb)
  - [4.4 Ajouter des tests de concurrence](#44-ajouter-des-tests-de-concurrence)
  - [4.5 Ajouter MFA/TOTP](#45-ajouter-mfatotp-pour-lauthentification)
  - [4.6 Refondre le modèle Workspace](#46-refondre-le-modèle-workspace)
  - [4.7 Implémenter le soft-delete QR codes](#47-implémenter-le-soft-delete-pour-les-qr-codes)
- [Checklist de validation](#checklist-de-validation)
- [Architecture des tests](#architecture-des-tests)

---

## Conventions générales

### Avant chaque implémentation
1. Lire le fichier concerné avec `Read` (jamais supposer le contenu)
2. Vérifier que `npm run typecheck` passe avant tout commit
3. Vérifier que `npm run test` passe avant tout commit
4. Ne JAMAIS utiliser `any` explicite ou implicite
5. Ne JAMAIS faire de `fetch` direct — passer par tRPC
6. Mutations BDD → passer par `src/server/services/` (jamais direct dans les routes)

### Structure des commits
```
type(scope): description concise

- Détail technique 1
- Détail technique 2

Closes #XXX
```

Types : `fix`, `feat`, `refactor`, `security`, `perf`, `test`, `chore`

### Tests
- Services : couverture minimale 80% (branches + lines)
- Routers tRPC : 100% des codes d'erreur testés
- E2E : tout nouveau parcours critique
- Exécuter `npm run test` et `npm run typecheck` avant chaque commit

---

# Sprint 1 — Correctifs critiques (semaine 1-2)

## 1.1 Implémenter la page liste QR codes

**🔴 Critique — La page principale de gestion des QR codes est vide.**

### Contexte
La page `src/app/(dashboard)/qr-codes/page.tsx` affiche uniquement un `<Header>` et un texte statique. Aucun rendu de liste, aucun data fetching. Les utilisateurs ne peuvent pas voir leurs QR codes.

### Objectif
Afficher une grille paginée de QR codes avec filtres (type, statut, recherche), états vides, et actions (pause, suppression).

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/app/(dashboard)/qr-codes/page.tsx` | Réécrire complètement |
| `src/hooks/use-qr-list.ts` | Créer/vérifier le hook |
| `src/components/qr/qr-card.tsx` | Vérifier et adapter si nécessaire |
| `src/components/qr/qr-list.tsx` | Créer (optionnel si inline) |
| `src/components/shared/pagination.tsx` | Créer si pas existant |
| `src/components/qr/qr-list-filters.tsx` | Créer |

### Étapes d'implémentation

#### Étape 1 — Créer le hook `useQRList`
```typescript
// src/hooks/use-qr-list.ts
"use client"

import { trpc } from "@/lib/trpc/client"
import { useState } from "react"
import type { QRType, QRStatus } from "@prisma/client"

interface UseQRListOptions {
  workspaceId: string
  initialLimit?: number
}

export function useQRList({ workspaceId, initialLimit = 20 }: UseQRListOptions) {
  const [filters, setFilters] = useState<{
    type?: QRType
    status?: QRStatus
    search?: string
  }>({})

  const utils = trpc.useUtils()

  const query = trpc.qr.list.useInfiniteQuery(
    {
      workspaceId,
      limit: initialLimit,
      ...filters,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  )

  return {
    items: query.data?.pages.flatMap((p) => p.items) ?? [],
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    filters,
    setFilters,
    refresh: () => utils.qr.list.invalidate(),
  }
}
```

#### Étape 2 — Créer les filtres
```typescript
// src/components/qr/qr-list-filters.tsx
"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import type { QRType, QRStatus } from "@prisma/client"

const QR_TYPES = ['URL','WHATSAPP','WIFI','VCARD','PDF','TEXT','LANDING_PAGE'] as const
const QR_STATUSES = ['ACTIVE','PAUSED'] as const

interface QRListFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  type?: QRType
  onTypeChange: (v?: QRType) => void
  status?: QRStatus
  onStatusChange: (v?: QRStatus) => void
}

export function QRListFilters({ search, onSearchChange, type, onTypeChange, status, onStatusChange }: QRListFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Rechercher un QR code..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
        aria-label="Rechercher un QR code"
      />
      <Select
        value={type ?? "all"}
        onValueChange={(v) => onTypeChange(v === "all" ? undefined : v as QRType)}
      >
        <SelectTrigger className="w-36" aria-label="Filtrer par type">
          <SelectValue placeholder="Tous les types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          {QR_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={status ?? "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? undefined : v as QRStatus)}
      >
        <SelectTrigger className="w-36" aria-label="Filtrer par statut">
          <SelectValue placeholder="Tous les statuts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="ACTIVE">Actifs</SelectItem>
          <SelectItem value="PAUSED">En pause</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

#### Étape 3 — Réécrire la page
```typescript
// src/app/(dashboard)/qr-codes/page.tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { prisma } from "@/server/db"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { QRCodeListClient } from "./qr-code-list-client"

export const metadata: Metadata = {
  title: "QR Codes — QR Studio",
  description: "Gérez vos QR codes dynamiques",
}

export default async function QRCodesListPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  })
  if (!workspace) redirect("/login")

  return (
    <div className="space-y-8">
      <Header
        title="QR Codes"
        description="Gérez vos QR codes dynamiques."
        actions={
          <Link href="/dashboard/qr/new">
            <Button variant="default" size="sm">
              <PlusIcon className="size-4" />
              Nouveau QR code
            </Button>
          </Link>
        }
      />
      <QRCodeListClient workspaceId={workspace.id} />
    </div>
  )
}
```

#### Étape 4 — Créer le composant client liste
```typescript
// src/app/(dashboard)/qr-codes/qr-code-list-client.tsx
"use client"

import { useQRList } from "@/hooks/use-qr-list"
import { QRCard } from "@/components/qr/qr-card"
import { QRListFilters } from "@/components/qr/qr-list-filters"
import { EmptyState } from "@/components/shared/empty-state"
import { QrCodeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import type { QRStatus } from "@prisma/client"

interface QRCodeListClientProps {
  workspaceId: string
}

export function QRCodeListClient({ workspaceId }: QRCodeListClientProps) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState("")
  const { items, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, filters, setFilters } = useQRList({ workspaceId })

  const deleteMutation = trpc.qr.delete.useMutation({
    onSuccess: () => router.refresh(),
  })
  const statusMutation = trpc.qr.updateStatus.useMutation({
    onSuccess: () => router.refresh(),
  })

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, search: value || undefined }))
    }, 400),
    [setFilters]
  )

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={QrCodeIcon}
        title="Aucun QR code"
        description="Créez votre premier QR code dynamique."
        action={{ label: "Nouveau QR code", href: "/dashboard/qr/new" }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <QRListFilters
        search={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v)
          debouncedSearch(v)
        }}
        type={filters.type}
        onTypeChange={(t) => setFilters((prev) => ({ ...prev, type: t }))}
        status={filters.status}
        onStatusChange={(s) => setFilters((prev) => ({ ...prev, status: s }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((qr) => (
          <QRCard
            key={qr.id}
            id={qr.id}
            name={qr.name}
            shortCode={qr.shortCode}
            type={qr.type}
            status={qr.status}
            totalScans={qr.totalScans}
            createdAt={qr.createdAt}
            onDelete={(id) => deleteMutation.mutate({ id, workspaceId })}
            onToggleStatus={(id, status) => statusMutation.mutate({ id, workspaceId, status })}
          />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Chargement..." : "Voir plus"}
          </Button>
        </div>
      )}
    </div>
  )
}
```

#### Étape 5 — Adapter `QRCard.tsx`
Uniformiser les props : le `role` n'est pas disponible dans le contexte de liste → rendre `onDelete` et `onToggleStatus` optionnels avec fallback.

### Critères d'acceptation
- [ ] La page `/dashboard/qr-codes` affiche une grille de cartes QR
- [ ] La pagination infinie fonctionne (scroll ou bouton "Voir plus")
- [ ] Les filtres par type, statut et recherche textuelle fonctionnent
- [ ] L'état vide s'affiche quand il n'y a pas de QR codes
- [ ] PAUSER/ACTIVER et Supprimer fonctionnent depuis la liste
- [ ] Le chargement (skeleton) s'affiche pendant le fetch
- [ ] Accessible : labels aria, focus visible, navigation clavier

### Tests
- **Unitaire :** `useQRList` — test des filtres, pagination, refresh
- **Intégration :** `qr.list` tRPC procedure — test des filtres combinés
- **E2E :** Parcours complet : création → visibilité dans la liste → filtre → pause → suppression

### Estimation : **XL** (2-3 jours)

---

## 1.2 Câbler les exports PNG/SVG/PDF dans QRCreator

**🔴 Critique — Les boutons d'export ne font rien.**

### Contexte
Dans `export-panel.tsx`, les callbacks `onExportPng`, `onExportSvg`, `onExportPdf` sont définis comme props mais jamais passés depuis `QRCreator` ou `QRCreatorStepper`.

### Objectif
Connecter les callbacks d'export pour que les boutons déclenchent le téléchargement.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/components/qr/qr-creator/export-panel.tsx` | Vérifier l'interface |
| `src/components/qr/qr-creator/index.tsx` | Connecter les callbacks |
| `src/components/qr/qr-creator/qr-creator-stepper.tsx` | Connecter les callbacks |
| `src/server/routers/qr.ts` | Vérifier que les exports `exportSvg`, `exportPng` sont OK |

### Étapes d'implémentation

#### Étape 1 — Analyser l'interface d'`ExportPanel`
Lire le fichier actuel et vérifier les props attendues :
```typescript
interface ExportPanelProps {
  qrCodeId: string
  workspaceId: string
  onExportPng?: () => void
  onExportSvg?: () => void
  onExportPdf?: () => void
}
```

#### Étape 2 — Implémenter les handlers d'export
Dans `QRCreatorStepper`, après création réussie du QR code (on a `id` et `shortCode`) :
```typescript
const handleExportPng = useCallback(async () => {
  if (!qrId) return
  try {
    const result = await trpc.qr.exportPng.query({
      id: qrId,
      workspaceId,
      size: 800,
    })
    const link = document.createElement("a")
    link.download = `qr-${shortCode}.png`
    link.href = `data:image/png;base64,${result.base64}`
    link.click()
  } catch (error) {
    toast.error("Échec de l'export PNG")
  }
}, [qrId, workspaceId, shortCode])
```

Même pattern pour `exportSvg` (retourne `{ svg }` → `data:image/svg+xml`) et `exportPdf` (retourne base64 → PDF).

#### Étape 3 — Ajouter les toasts de feedback
```typescript
// Import sonner toast
import { toast } from "sonner"

// Succès
toast.success("QR code exporté en PNG")

// Erreur
toast.error("Échec de l'export")
```

### Critères d'acceptation
- [ ] Cliquer "PNG" télécharge un fichier `.png` valide
- [ ] Cliquer "SVG" télécharge un fichier `.svg` valide
- [ ] Cliquer "PDF" télécharge un fichier `.pdf` valide
- [ ] Un toast de succès/erreur s'affiche
- [ ] L'export fonctionne sans rechargement de page

### Tests
- **Unitaire :** `exportSvg.query` et `exportPng.query` — vérifier le format de sortie
- **E2E :** Créer un QR → aller à l'étape export → vérifier que les boutons sont cliquables

### Estimation : **M** (1-2 jours)

---

## 1.3 Ajouter cascade delete sur Workspace.owner et QRCode→LandingPage

**🔴 Critique — `deleteAccount` échoue silencieusement.**

### Contexte
Le modèle `Workspace.ownerId` référence `User.id` sans `onDelete`. Quand `auth.service.ts:deleteAccount` appelle `prisma.user.delete()`, la FK `Workspace.ownerId` bloque la suppression → erreur 500. Même problème : `QRCode→LandingPage` sans cascade → LandingPage orphelines.

### Objectif
Corriger les relations Prisma pour garantir l'intégrité référentielle.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Modifier 2 relations |

### Étapes

#### Étape 1 — Modifier `prisma/schema.prisma`
```prisma
// Ligne ~110 — Workspace.owner
model Workspace {
  // ... autres champs ...
  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  //                                ajouter onDelete: Cascade ⬆️
}

// Ligne ~184 — QRCode.landingPage
model QRCode {
  // ... autres champs ...
  landingPage LandingPage? @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  //                                ajouter onDelete: Cascade ⬆️
}
```

#### Étape 2 — Vérifier l'impact sur `deleteAccount`
La cascade Prisma va maintenant supprimer :
1. `User` → cascade vers `Workspace` (owned) → cascade vers `QRCode` → cascade vers `Scan` (déjà fait)
2. `User` → cascade vers `WorkspaceMember` (déjà fait)
3. `QRCode` (LANDING_PAGE) → cascade vers `LandingPage` (nouveau)

**⚠️ Attention :** Vérifier que la cascade `User → Workspace` ne supprime pas des données qu'on voudrait garder. La règle métier dit que les QR codes FREE ne sont jamais désactivés, mais la suppression de compte est une action irréversible de l'utilisateur → acceptable.

#### Étape 3 — Générer la migration
```bash
npx prisma migrate dev --name add-cascade-delete
```

### Critères d'acceptation
- [ ] `deleteAccount` supprime l'utilisateur + tous ses workspaces + QR codes + scans
- [ ] La suppression d'un QR code LANDING_PAGE supprime aussi la LandingPage
- [ ] `npm run typecheck` passe
- [ ] Les tests passent (vérifier que les mocks Prisma sont à jour)

### Tests
- **Intégration :** Tester `auth.service.deleteAccount` — vérifier la suppression en cascade
- **Intégration :** Tester `qr.service.delete` — vérifier que la LandingPage est supprimée

### Estimation : **XS** (quelques heures)

---

## 1.4 Supprimer la duplication buildQRData (router → service)

**🟡 Moyen — Risque de désynchronisation entre deux versions de la même logique.**

### Contexte
La fonction `buildQRData()` dans `src/server/routers/qr.ts` (lignes 250-283) est une copie quasi-identique de `prepareQRData()` dans `src/server/services/qr.service.ts` (lignes 213-263).

### Objectif
Supprimer `buildQRData` du router et utiliser exclusivement `prepareQRData` (ou une version extraite).

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/routers/qr.ts` | Supprimer `buildQRData`, remplacer par `prepareQRData` depuis le service |
| `src/server/services/qr.service.ts` | Exporter `prepareQRData` si pas déjà exporté |

### Étapes

#### Étape 1 — Rendre `prepareQRData` publique
Dans `src/server/services/qr.service.ts` :
```typescript
// Exporter la fonction (actuellement privée)
export function prepareQRData(input: QRCreateInput, shortCode: string): string {
  // ... existing code ...
}
```

#### Étape 2 — Nettoyer le router
Dans `src/server/routers/qr.ts` :
```typescript
// Supprimer buildQRData (lignes 250-283)
// Remplacer les appels à buildQRData(qrCode) par qrService.prepareQRData(...)

// import { qrService } from "@/server/services/qr.service"
// Déjà importé, utiliser qrService.prepareQRData(...)
```

**Vérification :** `prepareQRData` attend `QRCreateInput` et un `shortCode`. Dans le router, on a un objet `qrCode` (entité Prisma) → adapter l'interface ou créer un adaptateur.

### Critères d'acceptation
- [ ] `buildQRData()` supprimée du router
- [ ] Toutes les références à `buildQRData()` remplacées
- [ ] Les exports SVG/PNG continuent de fonctionner
- [ ] `npm run typecheck` passe

### Tests
- **Unitaire :** `prepareQRData` — tester chaque type de QR

### Estimation : **XS** (1-2 heures)

---

## 1.5 Ajouter onDelete:Cascade et corriger VerificationToken PK

**🟡 Moyen — Intégrité de la table VerificationToken et cascade Workspace.**

### Contexte
- `VerificationToken` n'a pas de clé primaire explicite
- Plusieurs index redondants (`@@index` sur des colonnes déjà `@unique`)

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter PK, supprimer index redondants |

### Étapes

#### Étape 1 — Modifier `prisma/schema.prisma`
```prisma
model VerificationToken {
  id         String   @id @default(cuid())    // ← Ajouter
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  // @@index([token])  ← Déjà unique, supprimer
}
```

#### Étape 2 — Supprimer les index redondants
```prisma
model User {
  // ...
  @@index([email])     // ← SUPPRIMER (déjà @unique)
}

model QRCode {
  // ...
  @@index([shortCode]) // ← SUPPRIMER (déjà @unique)
}

model WorkspaceInvitation {
  // ...
  @@index([token])     // ← SUPPRIMER (déjà @unique)
}

model ApiKey {
  // ...
  @@index([keyHash])   // ← SUPPRIMER (déjà @unique)
}
```

#### Étape 3 — Générer la migration
```bash
npx prisma migrate dev --name cleanup-schema-indexes-pk
```

### Critères d'acceptation
- [ ] `VerificationToken` a une PK explicite
- [ ] Les index redondants sont supprimés
- [ ] Tous les tests passent (les mocks Prisma peuvent nécessiter mise à jour)

### Estimation : **XS** (1 heure)

---

## 1.6 Corriger le bug subscription.updated webhook Stripe

**🔴 Critique — Les changements de plan ne sont pas propagés.**

### Contexte
Dans `billing.service.ts:handleWebhookEvent`, le case `customer.subscription.updated` a une logique inversée : quand `userId` est présent dans les métadonnées (abonnements récents), le `if (!userId)` est `false` → le bloc `break` est exécuté → la mise à jour du plan n'est JAMAIS appliquée.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/services/billing.service.ts` | Corriger la logique inversée |

### Étapes

#### Étape 1 — Corriger la logique
```typescript
// Actuel (BUG)
case "customer.subscription.updated": {
  const subscription = event.data.object as Stripe.Subscription
  const userId = subscription.metadata?.userId

  if (!userId) {                 // ← Si userId est présent, on entre PAS ici
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { id: true },
    })
    if (!user) break

    const plan = mapStripePlanToPlan(subscription.items.data[0]?.price.id ?? "")
    await prisma.user.update({
      where: { id: user.id },
      data: { plan },
    })
  }
  // Pas d'else → quand userId existe, on ne fait rien → break implicite
  break
}

// Corrigé
case "customer.subscription.updated": {
  const subscription = event.data.object as Stripe.Subscription
  let userId = subscription.metadata?.userId

  // Si pas de metadata, chercher par stripeSubscriptionId
  if (!userId) {
    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      select: { id: true },
    })
    if (!user) break
    userId = user.id
  }

  const plan = mapStripePlanToPlan(subscription.items.data[0]?.price.id ?? "")
  await prisma.user.update({
    where: { id: userId },
    data: { plan },
  })
  break
}
```

#### Étape 2 — Ajouter un log structuré
```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.addBreadcrumb({
  category: "stripe",
  message: `Plan updated to ${plan} for user ${userId}`,
  level: "info",
})
```

### Critères d'acceptation
- [ ] Un upgrade/downgrade Stripe est répercuté en base
- [ ] Les abonnements avec metadata.userId sont mis à jour
- [ ] Les abonnements sans metadata (anciens) sont aussi mis à jour
- [ ] Le webhook Stripe ne casse pas pour d'autres événements

### Tests
- **Unitaire :** `billingService.handleWebhookEvent` — tester chaque type d'événement
- **Unitaire :** Tester le cas `subscription.updated` AVEC et SANS metadata.userId

### Estimation : **S** (0.5-1 jour)

---

## 1.7 Corriger la double sanitization WHATSAPP

**🔴 Critique — Les QR WHATSAPP pointent vers des URLs invalides.**

### Contexte
Deux sanitizations successives transforment `https://wa.me/0612345678` en `https://wa.me/httpswame0612345678` :
1. `getDestinationUrl()` dans `qr.service.ts` ligne 17 : retire les non-chiffres → produit une chaîne corrompue ("httpswame0612345678")
2. `prepareQRData()` dans `qr.service.ts` ligne 219 : refait l'opération sur le résultat déjà corrompu

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/services/qr.service.ts` | Corriger `getDestinationUrl` et `prepareQRData` |

### Étapes

#### Étape 1 — Analyser le flux
- `getDestinationUrl()` : pour WHATSAPP, devrait retourner le numéro nettoyé (chiffres uniquement)
- `prepareQRData()` : pour WHATSAPP, reconstruit `https://wa.me/{chiffres}`

Problème : `getDestinationUrl()` est utilisée pour stocker `destinationUrl` en DB. Elle nettoie déjà trop (transforme "https://wa.me/0612345678" en "httpswame0612345678"). Puis `prepareQRData()` refait le même chemin.

#### Étape 2 — Corriger `getDestinationUrl()`
```typescript
// Avant
case 'WHATSAPP': {
  const phone = input.destinationUrl ?? ''
  return phone.replace(/[^0-9]/g, '')  // ← Nettoie trop, casse l'URL d'entrée
}

// Après
case 'WHATSAPP': {
  const phone = input.destinationUrl ?? ''
  // Stocker seulement les chiffres (numéro nettoyé, pas l'URL complète)
  return phone.replace(/[^0-9]/g, '')
}
```

**Explication :** `getDestinationUrl()` doit stocker le numéro propre (chiffres), PAS l'URL complète `https://wa.me/...`. L'URL complète est reconstruite dans `prepareQRData()`. Le bug vient du fait que `prepareQRData()` nettoie À NOUVEAU le résultat déjà nettoyé. En réalité, le vrai problème est : où l'utilisateur saisit-il son numéro ? Si c'est un champ libre avec un format international, la première sanitization garde les chiffres → OK. Si le champ attend déjà `https://wa.me/...`, alors `getDestinationUrl()` est erronée.

**Solution pragmatique :** Supprimer `getDestinationUrl()` pour WHATSAPP (retourner `null` → pas stocké en DB), et construire l'URL uniquement dans `prepareQRData()`.

```typescript
function getDestinationUrl(type: QRType, input: QRCreateInput): string | null {
  switch (type) {
    case 'URL':
    case 'PDF':
      return input.destinationUrl ?? null
    case 'WHATSAPP':
      return null  // ← L'URL est construite dans prepareQRData
    case 'WIFI':
      return `${input.wifi?.ssid ?? ''}${input.wifi?.password ? ':' + input.wifi.password : ''}`
    case 'TEXT':
    case 'VCARD':
    case 'LANDING_PAGE':
      return null
  }
}
```

Et dans `prepareQRData()` pour WHATSAPP :
```typescript
case 'WHATSAPP': {
  // Extraire le numéro depuis destinationUrl OU input
  const rawPhone = input.destinationUrl ?? ''
  const phone = rawPhone.replace(/[^0-9]/g, '')
  return `https://wa.me/${phone}`
}
```

### Critères d'acceptation
- [ ] Un QR WHATSAPP avec `destinationUrl = "0612345678"` produit `https://wa.me/0612345678`
- [ ] Un QR WHATSAPP avec `destinationUrl = "https://wa.me/0612345678"` produit aussi `https://wa.me/0612345678`
- [ ] Les QR WHATSAPP existants en base continuent de fonctionner (vérifier migration)

### Tests
- **Unitaire :** `prepareQRData()` pour WHATSAPP — tester plusieurs formats d'entrée
- **Unitaire :** `getDestinationUrl()` pour WHATSAPP — doit retourner `null`

### Estimation : **XS** (1-2 heures)

---

## 1.8 Supprimer le Dialog imbriqué ApiKeyManager

**🟡 Moyen — Double overlay, comportement d'ouverture/fermeture incohérent.**

### Contexte
`ApiKeyManager` rend un `<Dialog>` qui contient un trigger, et `ApiKeyModal` (importé) utilise aussi `<Dialog>` pour son contenu. On a donc 2 Dialog imbriqués.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/components/settings/api-key-manager.tsx` | Supprimer le Dialog externe |
| `src/components/settings/api-key-modal.tsx` | Simplifier (ne pas être un Dialog complet) |

### Étapes

#### Étape 1 — Lire les deux fichiers
Comprendre les responsabilités : `ApiKeyManager` liste les clés + déclenche la création. `ApiKeyModal` affiche le formulaire de création.

#### Étape 2 — Solution 1 (recommandée) : `ApiKeyManager` n'est PAS un Dialog
```typescript
// api-key-manager.tsx — Supprimer le wrapper Dialog
export function ApiKeyManager() {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3>Clés API</h3>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusIcon className="size-4" />
          Nouvelle clé
        </Button>
      </div>

      {showCreateModal && (
        <ApiKeyModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Liste des clés */}
      ...
    </div>
  )
}
```

#### Étape 3 — Solution alternative : `ApiKeyModal` devient Dialog interne
```typescript
// api-key-modal.tsx — Utiliser AlertDialog ou Dialog directement
export function ApiKeyModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle clé API</DialogTitle>
        </DialogHeader>
        {/* ...formulaire... */}
      </DialogContent>
    </Dialog>
  )
}
```

### Critères d'acceptation
- [ ] Un seul overlay visible à la fois
- [ ] L'ouverture/fermeture de la modale est fluide
- [ ] Pas de warning React (findDOMNode, etc.)
- [ ] Accessible : focus trap fonctionnel

### Tests
- Visuel : vérifier qu'un seul backdrop est rendu
- E2E : ouvrir la modale, vérifier qu'elle se ferme correctement

### Estimation : **S** (4-6 heures)

---

# Sprint 2 — Stabilisation (semaine 3-6)

## 2.1 Migrer le rate limiting vers Redis/Upstash

**🔴 Critique — Ne fonctionne pas en multi-instance.**

### Contexte
Rate limiting in-memory (`middleware.ts:5`) : le `Map<string, { count, resetAt }>` est local à chaque processus. En scaling horizontal, le quota est multiplié par le nombre d'instances.

### Objectif
Remplacer par un cache distribué compatible Edge Runtime (Upstash Redis, Vercel KV).

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `package.json` | Ajouter `@upstash/ratelimit` et `@upstash/redis` |
| `src/middleware.ts` | Remplacer le Map par Upstash/Redis |
| `.env.example` | Ajouter `UPSTASH_REDIS_URL` |
| `src/lib/rate-limit.ts` | Créer (config centralisée) |

### Étapes

#### Étape 1 — Installer les dépendances
```bash
npm install @upstash/ratelimit @upstash/redis
```

#### Étape 2 — Créer le module de configuration
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

// QR API rate limit : 100 requêtes par fenêtre de 60s
export const qrRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit/qr",
})

// Auth rate limit : 30 tentatives par fenêtre de 1h (augmenté de 5→30)
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
})
```

#### Étape 3 — Mettre à jour le middleware
```typescript
// src/middleware.ts
import { qrRateLimit, authRateLimit } from "@/lib/rate-limit"

// Supprimer rateLimitMap, getRateLimitInfo, QR_RATE_LIMIT_*, AUTH_RATE_LIMIT_*

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.pathname
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  if (url.startsWith("/api/qr/")) {
    const { success, remaining } = await qrRateLimit.limit(ip)
    if (!success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      })
    }
    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return response
  }

  if (["/login", "/register"].includes(url)) {
    const { success } = await authRateLimit.limit(ip)
    if (!success) {
      return new NextResponse("Trop de tentatives. Réessayez dans une heure.", {
        status: 429,
        headers: { "Retry-After": "3600" },
      })
    }
  }

  // ... reste du middleware inchangé (auth redirect, public prefixes) ...
}
```

#### Étape 4 — Mettre à jour les variables d'environnement
```env
# .env.example
UPSTASH_REDIS_URL="..."
UPSTASH_REDIS_TOKEN="..."
```

### Critères d'acceptation
- [ ] Rate limit distribué : 2 instances distinctes partagent le même compteur
- [ ] Rate limit QR : 100 req/min, retourne `X-RateLimit-Remaining`
- [ ] Rate limit auth : 30 req/h, retourne 429 après dépassement
- [ ] Persistant : un redémarrage ne reset pas les compteurs
- [ ] Compatible Edge Runtime (le middleware Next.js tourne en Edge)
- [ ] `npm run typecheck` passe

### Tests
- **Unitaire :** `rate-limit.ts` — tester les limites QR et auth
- **Unitaire (mock) :** `middleware.ts` — tester le comportement avec rate limit atteint/non atteint
- **E2E :** Envoyer 101 requêtes à `/api/qr/test` → la 101e retourne 429

### Estimation : **S** (1-2 jours)

---

## 2.2 Ajouter l'idempotency sur le webhook Stripe

**🔴 Critique — Stripe peut délivrer le même événement plusieurs fois.**

### Contexte
Stripe garantit "at least once" delivery. Sans déduplication, un même événement `checkout.session.completed` ou `customer.subscription.updated` peut être traité deux fois → double mise à jour du plan, double création d'abonnement.

### Objectif
Stocker les IDs d'événements Stripe dans une table dédiée et ignorer les doublons.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter modèle `WebhookEvent` |
| `src/server/services/billing.service.ts` | Ajouter la vérification d'idempotency |
| `src/app/api/webhooks/stripe/route.ts` | Ajouter le constructEvent avec signature |

### Étapes

#### Étape 1 — Ajouter le modèle Prisma
```prisma
// prisma/schema.prisma
model WebhookEvent {
  id        String   @id
  type      String
  processedAt DateTime @default(now())

  @@index([processedAt])
}
```

Le `id` est l'`event.id` Stripe (ex: `evt_3Nc...`).

#### Étape 2 — Créer les helpers d'idempotency
```typescript
// src/server/services/stripe-idempotency.ts
import { prisma } from "@/server/db"

export async function hasEventBeenProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  })
  return existing !== null
}

export async function markEventProcessed(eventId: string, type: string): Promise<void> {
  await prisma.webhookEvent.create({
    data: { id: eventId, type },
  })
}
```

#### Étape 3 — Modifier `handleWebhookEvent`
```typescript
// src/server/services/billing.service.ts
import { hasEventBeenProcessed, markEventProcessed } from "./stripe-idempotency"

export const billingService = {
  async handleWebhookEvent(event: Stripe.Event) {
    // Idempotency check
    if (await hasEventBeenProcessed(event.id)) {
      return { skipped: true }
    }

    try {
      switch (event.type) {
        // ... existing cases ...
      }

      // Marquer comme traité après succès
      await markEventProcessed(event.id, event.type)
    } catch (error) {
      Sentry.captureException(error)
      throw error // Stripe retry si on retourne 500
    }
  },
}
```

#### Étape 4 — Vérifier la route webhook
```typescript
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  try {
    await billingService.handleWebhookEvent(event)
    return new Response("OK", { status: 200 })
  } catch {
    return new Response("Internal Server Error", { status: 500 })
  }
}
```

### Critères d'acceptation
- [ ] Un webhook reçu 2x par Stripe est ignoré la 2e fois
- [ ] Les événements sont stockés avec leur type et date de traitement
- [ ] La signature Stripe est bien vérifiée
- [ ] Les événements existants continuent de fonctionner

### Tests
- **Unitaire :** Tester `hasEventBeenProcessed` avec et sans événement existant
- **Unitaire :** Tester que `handleWebhookEvent` marque l'événement après traitement
- **Intégration :** Simuler 2 appels webhook identiques → 1 seul traitement

### Estimation : **M** (1-2 jours)

---

## 2.3 Rendre recordScan asynchrone

**🔴 Critique — 3-4 writes DB synchrones bloquent le redirect QR.**

### Contexte
`analyticsService.recordScan()` fait 1 INSERT + 1 UPDATE + 1 SELECT + potentiellement 1 UPDATE dans le flux de redirect. Cela ajoute 100-300ms de latence pour l'utilisateur qui scanne le QR code. Sous charge, les scans sont perdus.

### Objectif
Déporter l'enregistrement des scans hors du flux de redirect (fire-and-forget avec queue).

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `package.json` | Ajouter une lib de queue (BullMQ ou PgBoss) |
| `src/queue/index.ts` | Créer |
| `src/queue/workers/scan-recorder.ts` | Créer |
| `src/server/services/analytics.service.ts` | Modifier `recordScan` pour qu'elle soit asynchrone |
| `src/app/api/qr/[shortCode]/route.ts` | Remplacer l'appel synchrone par `queue.add()` |
| `src/server/queue.ts` | Créer (optionnel si intégré dans server/) |

### Étapes

#### Étape 1 — Choisir la solution de queue
Options (par ordre de préférence) :

| Solution | Avantages | Inconvénients |
|---|---|---|
| **PgBoss** (PostgreSQL) | Pas de nouvelle infra, utilise la DB existante, supporte Node.js natif | Pas compatible Edge |
| **BullMQ** (Redis) | Très mature, retry, scheduling | Nécessite Redis (déjà prévu pour rate limit) |
| **Simple array + setInterval** | Zéro dépendance, fonctionnel pour un MVP | Perte de scans si crash serveur, pas de persistance |

**Recommandation : PgBoss** car PostgreSQL est déjà l'infra existante. Sinon BullMQ si Redis est déjà déployé.

#### Étape 2 — Installer PgBoss
```bash
npm install pg-boss
npm install -D @types/pg-boss
```

#### Étape 3 — Créer la configuration de la queue
```typescript
// src/server/queue.ts
import PgBoss from "pg-boss"

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!)
    await boss.start()
  }
  return boss
}

export const QUEUE_NAMES = {
  RECORD_SCAN: "record-scan",
  CLEANUP_EXPIRED: "cleanup-expired",
} as const
```

#### Étape 4 — Créer le worker
```typescript
// src/server/workers/scan-recorder.ts
import { getQueue, QUEUE_NAMES } from "@/server/queue"
import { analyticsService } from "@/server/services/analytics.service"
import * as Sentry from "@sentry/nextjs"

export async function startScanRecorderWorker() {
  const queue = await getQueue()

  await queue.work(QUEUE_NAMES.RECORD_SCAN, async ([job]) => {
    try {
      await analyticsService.recordScan(job.data)
    } catch (error) {
      Sentry.captureException(error)
      throw error // PgBoss retry automatiquement
    }
  })
}
```

#### Étape 5 — Modifier le flux de redirect
```typescript
// src/app/api/qr/[shortCode]/route.ts
import { getQueue, QUEUE_NAMES } from "@/server/queue"

export async function GET(req: Request, { params }: Props) {
  const { shortCode } = await params

  // 1. Résoudre le QR code (read rapide)
  const qrCode = await prisma.qRCode.findUnique({
    where: { shortCode },
    select: { id: true, type: true, status: true, destinationUrl: true },
  })

  if (!qrCode || qrCode.status === "PAUSED") {
    return redirect(qrCode?.status === "PAUSED" ? "/qr-paused" : "/qr-not-found")
  }

  // 2. Enregistrer le scan de manière asynchrone (NE BLOQUE PAS)
  const ip = req.headers.get("x-forwarded-for") ?? undefined
  const userAgent = req.headers.get("user-agent") ?? undefined
  const referer = req.headers.get("referer") ?? undefined

  const queue = await getQueue()
  await queue.send(QUEUE_NAMES.RECORD_SCAN, {
    qrCodeId: qrCode.id,
    ip,
    userAgent,
    referer,
  })

  // 3. Rediriger immédiatement (pas d'attente)
  const destination = resolveDestination(qrCode)
  return redirect(destination)
}
```

#### Étape 6 — Démarrer le worker au boot
```typescript
// src/instrumentation.ts (ou un fichier de démarrage)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScanRecorderWorker } = await import("@/server/workers/scan-recorder")
    await startScanRecorderWorker()
  }
}
```

### Critères d'acceptation
- [ ] Le redirect QR s'effectue sans attendre l'enregistrement du scan
- [ ] Les scans sont bien persistés (vérifier en base)
- [ ] En cas d'échec, le worker retry automatiquement
- [ ] Pas de perte de scans si le serveur redémarre (PgBoss garantit la persistance)
- [ ] Les compteurs `totalScans` et `uniqueScans` sont corrects

### Tests
- **Unitaire :** `recordScan` — tester l'insertion et les compteurs
- **Intégration :** Simuler un redirect → vérifier que le scan est enregistré (avec attente)
- **Performance :** Benchmark du temps de redirect (devrait passer < 50ms)

### Estimation : **L** (3-5 jours)

---

## 2.4 Implémenter l'agrégation SQL pour getScansByDay et dashboard

**🔴 Critique — Aggrégation JS en mémoire, OOM sous charge.**

### Contexte
`getScansByDay()` et `getDashboardStats()` chargent TOUS les enregistrements de la table `Scan` en mémoire puis les agrègent en JavaScript. Pour un QR code populaire (500k scans), cela provoque OOM/timeout.

### Objectif
Remplacer l'agrégation JS par des requêtes SQL natives avec `GROUP BY`.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/services/analytics.service.ts` | Réécrire `getScansByDay`, `getDashboardStats`, `getGroupedCounts` |

### Étapes

#### Étape 1 — Réécrire `getScansByDay` avec Prisma `groupBy`
```typescript
// Version actuelle (lignes 211-230) — À SUPPRIMER
// Charge toutes les scans en mémoire

// Nouvelle version
async function getScansByDay(
  qrCodeId: string,
  sinceDate: Date | null
): Promise<{ date: string; scans: number }[]> {
  const whereClause = sinceDate
    ? { qrCodeId, scannedAt: { gte: sinceDate } }
    : { qrCodeId }

  // Utiliser $queryRaw pour GROUP BY DATE (Prisma groupBy ne supporte pas les transformations de date)
  const results = await prisma.$queryRaw<
    Array<{ date: string; count: bigint }>
  >`
    SELECT 
      DATE(scanned_at) as date,
      COUNT(*)::int as count
    FROM "Scan"
    WHERE "qrCodeId" = ${qrCodeId}
      ${sinceDate ? Prisma.sql`AND scanned_at >= ${sinceDate}` : Prisma.empty}
    GROUP BY DATE(scanned_at)
    ORDER BY date ASC
  `

  return results.map((r) => ({
    date: r.date,
    scans: Number(r.count),
  }))
}
```

**Alternative avec `groupBy` Prisma (si compatible) :**
```typescript
// Prisma groupBy — fonctionne si on n'a pas besoin de transformation de date
const results = await prisma.scan.groupBy({
  by: ["scannedAt"],
  where: { qrCodeId, scannedAt: { gte: sinceDate ?? undefined } },
  _count: { scannedAt: true },
  orderBy: { scannedAt: "asc" },
})
```

Mais Prisma `groupBy` groupe par valeur exacte de `scannedAt` (timestamp), pas par date. Il faut donc une raw query ou `$queryRaw`.

#### Étape 2 — Réécrire `getDashboardStats.scansLast7Days`
```typescript
// Remplacer le findMany + Map par une raw query
const scansLast7Days = await prisma.$queryRaw<
  Array<{ date: string; count: bigint }>
>`
  SELECT 
    DATE(scanned_at) as date,
    COUNT(*)::int as count
  FROM "Scan"
  WHERE "qrCodeId" IN (
    SELECT id FROM "QRCode" WHERE "workspaceId" = ${workspaceId}
  )
    AND scanned_at >= ${sevenDaysAgo}
  GROUP BY DATE(scanned_at)
  ORDER BY date ASC
`
```

#### Étape 3 — Simplifier `getGroupedCounts`
```typescript
// Renommer pour clarté et utiliser des types corrects
async function getTopCountries(qrCodeId: string, sinceDate: Date | null) {
  return prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
    SELECT country, COUNT(*)::int as count
    FROM "Scan"
    WHERE "qrCodeId" = ${qrCodeId}
      ${sinceDate ? Prisma.sql`AND scanned_at >= ${sinceDate}` : Prisma.empty}
      AND country IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
    LIMIT 10
  `
}
```

#### Étape 4 — Supprimer les anciennes fonctions helper
Supprimer `getGroupedCounts`, `mapCountryData`, `mapDeviceData`, `mapOsData` une fois les nouvelles implémentations validées.

### Critères d'acceptation
- [ ] `getAnalytics` ne charge plus TOUTES les scans en mémoire
- [ ] Les résultats sont identiques à l'ancienne version (à confirmer sur un jeu de données)
- [ ] Le temps de réponse pour un QR code avec 100k scans < 200ms (contre plusieurs secondes avant)
- [ ] `getDashboardStats` charge les 7 derniers jours avec une seule requête SQL

### Tests
- **Unitaire :** Tester les nouvelles fonctions avec un mock Prisma
- **Performance :** Benchmark sur un jeu de données de 100k+ scans

### Estimation : **M** (2-3 jours)

---

## 2.5 Ajouter les index composites manquants

**🟡 Moyen — Amélioration immédiate des performances analytics.**

### Contexte
Les filtres de liste QR codes (`workspaceId + type + status`) et la déduplication de scan (`qrCodeId + ipHash`) n'ont pas d'index composites.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter 2 index composites |

### Étapes

#### Étape 1 — Ajouter les index
```prisma
model QRCode {
  // ...
  @@index([workspaceId, type, status])
}

model Scan {
  // ...
  @@index([qrCodeId, ipHash])
}
```

#### Étape 2 — Générer la migration
```bash
npx prisma migrate dev --name add-composite-indexes
```

### Critères d'acceptation
- [ ] Les index sont créés en base
- [ ] Les requêtes de filtrage liste QR utilisent l'index composite
- [ ] La déduplication de scan unique utilise l'index composite

### Tests
- Vérifier avec `EXPLAIN ANALYZE` que les index sont utilisés

### Estimation : **XS** (1 heure)

---

## 2.6 Ajouter un verrouillage de compte

**🟡 Moyen — Protection contre les attaques brute-force.**

### Contexte
Aucune limitation sur les tentatives de connexion. Un attaquant peut essayer des millions de mots de passe.

### Objectif
Verrouiller temporairement le compte après 5 tentatives échouées consécutives.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter `loginAttempts` et `lockoutUntil` sur User |
| `src/server/services/auth.service.ts` | Ajouter la logique de verrouillage |
| `src/server/routers/auth.ts` | Vérifier le verrouillage avant connexion |

### Étapes

#### Étape 1 — Ajouter les champs au modèle User
```prisma
model User {
  // ... existing fields ...
  loginAttempts    Int       @default(0)
  lockoutUntil     DateTime?
}
```

#### Étape 2 — Créer le helper de verrouillage
```typescript
// src/server/services/auth.service.ts
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

async function checkLockout(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { loginAttempts: true, lockoutUntil: true },
  })

  if (!user) return // Silencieux pour ne pas révéler l'existence du compte

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const remaining = Math.ceil(
      (user.lockoutUntil.getTime() - Date.now()) / 1000 / 60
    )
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Compte verrouillé. Réessayez dans ${remaining} minute(s).`,
    })
  }

  // Si le lockout a expiré, réinitialiser
  if (user.lockoutUntil && user.lockoutUntil <= new Date()) {
    await prisma.user.update({
      where: { email },
      data: { loginAttempts: 0, lockoutUntil: null },
    })
  }
}

async function recordFailedAttempt(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { loginAttempts: true },
  })

  if (!user) return

  const newAttempts = user.loginAttempts + 1

  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    await prisma.user.update({
      where: { email },
      data: {
        loginAttempts: newAttempts,
        lockoutUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
      },
    })
  } else {
    await prisma.user.update({
      where: { email },
      data: { loginAttempts: newAttempts },
    })
  }
}

async function resetLoginAttempts(email: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: { loginAttempts: 0, lockoutUntil: null },
  })
}
```

#### Étape 3 — Intégrer dans la route d'authentification
```typescript
// src/server/routers/auth.ts
// Ou directement dans le provider credentials
async authorize(credentials) {
  const email = credentials.email as string

  await checkLockout(email)

  // ... vérifier mot de passe ...

  if (!isValid) {
    await recordFailedAttempt(email)
    return null
  }

  await resetLoginAttempts(email)
  return user
}
```

### Critères d'acceptation
- [ ] Après 5 échecs consécutifs, le compte est verrouillé 15 minutes
- [ ] L'utilisateur reçoit un message "Compte verrouillé. Réessayez dans X minutes."
- [ ] La connexion réussie réinitialise le compteur
- [ ] Le lockout expire automatiquement après 15 minutes
- [ ] L'endpoint ne révèle pas si l'email existe (réponse identique)

### Tests
- **Unitaire :** Tester `checkLockout`, `recordFailedAttempt`, `resetLoginAttempts`
- **Intégration :** Simuler 6 échecs → vérifier le lockout
- **Intégration :** Simuler un lockout → attendre → la connexion fonctionne à nouveau

### Estimation : **S** (1 jour)

---

## 2.7 Bloquer le statut PAUSED pour les utilisateurs FREE

**🟠 Haut — Violation de la règle métier "les QR codes FREE ne sont jamais désactivés".**

### Contexte
`qrRouter.updateStatus` ne vérifie pas le plan de l'utilisateur. Un utilisateur FREE peut mettre en pause ses QR codes, ce qui viole la règle métier.

### Objectif
Interdire le statut PAUSED pour les utilisateurs FREE.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/routers/qr.ts` | Ajouter vérification du plan dans `updateStatus` |
| `src/server/services/qr.service.ts` | Créer `updateStatus()` dans le service |

### Étapes

#### Étape 1 — Déplacer la logique dans le service
```typescript
// src/server/services/qr.service.ts
async updateStatus(id: string, workspaceId: string, status: QRStatus, userId: string): Promise<void> {
  // 1. Vérifier l'accès au workspace
  await requireWorkspaceAccess(userId, workspaceId)

  // 2. Récupérer le QR code
  const existing = await prisma.qRCode.findFirst({
    where: { id, workspaceId },
  })
  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'QR code introuvable' })
  }

  // 3. Vérifier le rôle
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!member || member.role === 'VIEWER') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Action non autorisée' })
  }

  // 4. 🔴 RÈGLE MÉTIER : FREE ne peut pas PAUSER
  const workspaceOwner = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { owner: { select: { plan: true } } },
  })

  if (workspaceOwner?.owner.plan === 'FREE' && status === 'PAUSED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Les QR codes du plan Gratuit ne peuvent pas être mis en pause.',
    })
  }

  // 5. Effectuer la mise à jour
  await prisma.qRCode.update({
    where: { id },
    data: { status },
  })
}
```

#### Étape 2 — Adapter le router
```typescript
// src/server/routers/qr.ts
updateStatus: workspaceProcedure
  .input(z.object({ id: z.string(), workspaceId: z.string(), status: QRStatusEnum }))
  .mutation(async ({ ctx, input }) => {
    await qrService.updateStatus(input.id, input.workspaceId, input.status as QRStatus, ctx.user!.id)
    return { success: true }
  }),
```

### Critères d'acceptation
- [ ] Un utilisateur FREE reçoit une erreur FORBIDDEN en essayant de mettre en pause
- [ ] Les utilisateurs PRO et AGENCY peuvent toujours mettre en pause
- [ ] L'activation (PAUSED → ACTIVE) fonctionne pour tous les plans
- [ ] La règle métier est documentée (constante ou commentaire)

### Tests
- **Unitaire :** `qrService.updateStatus` — test avec plan FREE, PRO, AGENCY
- **Intégration :** Tester l'appel tRPC `qr.updateStatus` pour chaque plan

### Estimation : **XS** (2-3 heures)

---

## 2.8 Appliquer la rétention analytics

**🟠 Haut — Fuite de données payantes pour les utilisateurs FREE.**

### Contexte
`PLAN_LIMITS.analyticsRetentionDays` définit FREE=30j, PRO=365j, AGENCY=∞, mais `getAnalytics` ne vérifie jamais cette limite.

### Objectif
Tronquer les résultats analytics selon le plan de l'utilisateur.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/services/analytics.service.ts` | Ajouter la vérification de rétention |
| `src/server/routers/qr.ts` | Passer le plan dans l'appel |

### Étapes

#### Étape 1 — Modifier `getAnalytics` pour accepter la rétention
```typescript
// src/server/services/analytics.service.ts
async getAnalytics(
  qrCodeId: string,
  period: '7d' | '30d' | '90d' | 'all',
  retentionDays?: number // ← Nouveau paramètre optionnel
) {
  // Calculer la date max selon la rétention
  let effectiveSinceDate = getPeriodDate(period)
  
  if (retentionDays && retentionDays !== Infinity) {
    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() - retentionDays)
    
    // Si la période demandée dépasse la rétention, tronquer
    if (!effectiveSinceDate || effectiveSinceDate < retentionDate) {
      effectiveSinceDate = retentionDate
    }
  }

  // ... utiliser effectiveSinceDate au lieu de sinceDate ...
}
```

#### Étape 2 — Passer le plan depuis le router
```typescript
// src/server/routers/qr.ts
getAnalytics: workspaceProcedure
  .input(z.object({ qrCodeId: z.string(), workspaceId: z.string(), period: PeriodEnum.default('30d') }))
  .query(async ({ ctx, input }) => {
    await workspaceQuery(ctx, input.workspaceId)
    
    // Calculer la rétention selon le plan
    const user = await prisma.user.findUnique({
      where: { id: ctx.user!.id },
      select: { plan: true },
    })
    const retentionDays = user?.plan === 'FREE' ? 30 : user?.plan === 'PRO' ? 365 : undefined
    
    return analyticsService.getAnalytics(input.qrCodeId, input.period, retentionDays)
  }),
```

#### Étape 3 — Ajouter un job de purge pour les scans expirés
```typescript
// À faire dans le même sprint ou dans un follow-up
// src/server/jobs/cleanup-scans.ts
export async function cleanupExpiredScans(): Promise<number> {
  // Supprimer les scans des utilisateurs FREE de plus de 30 jours
  const result = await prisma.scan.deleteMany({
    where: {
      scannedAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      qrCode: {
        workspace: {
          owner: { plan: "FREE" },
        },
      },
    },
  })

  return result.count
}
```

### Critères d'acceptation
- [ ] Un utilisateur FREE avec `period='all'` ne voit que les 30 derniers jours
- [ ] Un utilisateur PRO avec `period='all'` voit jusqu'à 365 jours
- [ ] Les périodes plus courtes que la rétention ne sont pas affectées
- [ ] AGENCY voit tout l'historique
- [ ] L'export CSV respecte aussi la rétention

### Tests
- **Unitaire :** Tester `getAnalytics` avec différentes combinaisons period × plan
- **Intégration :** Vérifier que les données hors rétention sont exclues

### Estimation : **S** (1 jour)

---

# Sprint 3 — Amélioration (mois 2-3)

## 3.1 Extraire computeQRData dans un utilitaire partagé

**🟡 Moyen — Duplication de code entre 2 composants.**

### Contexte
`computeQRData()` est dupliqué dans `qr-creator/index.tsx` et `qr-editor.tsx`.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/lib/qr-utils.ts` | Créer (ou ajouter à `qr-generator.ts`) |
| `src/components/qr/qr-creator/index.tsx` | Supprimer la version locale, importer |
| `src/components/qr/qr-editor.tsx` | Supprimer la version locale, importer |

### Étapes

#### Étape 1 — Extraire dans `src/lib/qr-utils.ts`
```typescript
// src/lib/qr-utils.ts
export function computeQRData(input: {
  type: string
  destinationUrl?: string | null
  wifiSsid?: string | null
  wifiPassword?: string | null
  wifiEncryption?: string | null
  vcardJson?: string | null
  textContent?: string | null
  shortCode?: string
}): string {
  // Même logique que buildQRData dans qr.service.ts
  // mais adaptée pour le front-end
  switch (input.type) {
    case 'URL':
      return input.destinationUrl ?? ''
    // ... etc
  }
}
```

#### Étape 2 — Nettoyer les composants
Dans chaque composant, supprimer la fonction locale et remplacer par :
```typescript
import { computeQRData } from "@/lib/qr-utils"
```

### Critères d'acceptation
- [ ] `computeQRData` n'existe qu'en un seul endroit
- [ ] Les deux composants fonctionnent identiquement avant/après

### Estimation : **XS** (1-2 heures)

---

## 3.2 Supprimer les couleurs hardcodées

**🟡 Moyen — Incohérence visuelle avec le design system.**

### Contexte
`CurrentPlanBanner` utilise `bg-blue-100`, `text-blue-800`, `bg-purple-100`, `bg-green-600` qui bypassent les tokens du design system et cassent le dark mode.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/components/billing/current-plan-banner.tsx` | Remplacer par des classes sémantiques |

### Étapes

#### Étape 1 — Remplacer les couleurs par des tokens design system
```typescript
// Avant
<div className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
  Plan Gratuit
</div>

// Après
<div className="bg-muted text-muted-foreground border border-border">
  Plan Gratuit
</div>

// Pour PRO
<div className="bg-primary/10 text-primary border border-primary/20">
  Plan Pro
</div>

// Pour AGENCY
<div className="bg-accent text-accent-foreground border border-accent">
  Plan Agency
</div>
```

### Critères d'acceptation
- [ ] Les couleurs respectent les tokens du design system
- [ ] Le dark mode fonctionne correctement
- [ ] La hiérarchie visuelle entre plans est conservée

### Estimation : **XS** (1-2 heures)

---

## 3.3 Ajouter retry + timeout sur les appels externes

**🟡 Moyen — Les pannes transitoires deviennent des erreurs 500 permanentes.**

### Contexte
Aucun retry ni timeout explicite sur Stripe, Resend, Prisma, et ip-api.com.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/lib/retry.ts` | Créer |
| `src/server/services/billing.service.ts` | Ajouter retry Stripe |
| `src/server/services/email.service.ts` | Ajouter retry Resend |
| `src/server/db.ts` | Configurer timeout Prisma |
| `src/server/services/analytics.service.ts` | Ajouter retry ip-api (si encore synchrone) |

### Étapes

#### Étape 1 — Créer le helper de retry
```typescript
// src/lib/retry.ts
interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  timeout?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, timeout = 30000 } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout wrapper
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        ),
      ])
      return result
    } catch (error) {
      lastError = error as Error
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

// Usage: const subscription = await withRetry(() => stripe.subscriptions.retrieve(id))
```

#### Étape 2 — Appliquer sur Stripe
```typescript
// src/server/services/billing.service.ts
import { withRetry } from "@/lib/retry"

const stripe = new Stripe(secretKey, {
  timeout: 10000, // 10s au lieu du défaut 75s
})

// Dans createCheckoutSession :
const session = await withRetry(
  () => stripe.checkout.sessions.create({ ... }),
  { maxRetries: 2, baseDelay: 500, timeout: 15000 }
)
```

#### Étape 3 — Appliquer sur Prisma
```typescript
// src/server/db.ts
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  // Note : Prisma n'a pas de timeout global configurable en 5.x
  // Utiliser withRetry autour des appels critiques
})
```

### Critères d'acceptation
- [ ] Les appels Stripe ont un timeout de 10s (au lieu de 75s)
- [ ] Les appels Stripe retentent 2 fois avec backoff exponentiel
- [ ] Les appels Resend ont le même pattern
- [ ] Les erreurs transitoires (429, 503) sont retentées
- [ ] Les erreurs permanentes (400, 401, 404) ne sont PAS retentées

### Tests
- **Unitaire :** Tester `withRetry` avec des erreurs simulées
- **Unitaire :** Tester que les erreurs 4xx ne sont pas retentées (option `shouldRetry`)

### Estimation : **M** (2-3 jours)

---

## 3.4 Rendre la géolocalisation IP asynchrone

**🟠 Haut — Bloque le redirect QR avec un appel synchrone ip-api.com (3s timeout).**

### Contexte
`analyticsService.recordScan()` appelle `getCountry(data.ip)` qui fait un fetch HTTP synchrone à ip-api.com. Après le passage asynchrone de `recordScan` (Sprint 2, action 2.3), ce problème est déjà en partie résolu. Mais il faut aussi améliorer la géolocalisation elle-même.

### Objectif
Remplacer ip-api.com par une solution plus robuste : MaxMind DB locale, Vercel Edge GeoIP, ou cache Redis.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/lib/geo.ts` | Réécrire |
| `package.json` | Ajouter maxmind ou @maxmind/geoip2-node |

### Étapes

#### Étape 1 — Solution recommandée : Vercel Edge GeoIP (si déployé sur Vercel)
```typescript
// src/lib/geo.ts
// Vercel fournit `request.geo` dans les Edge Functions
// Mais pour les workers Node (PgBoss), il faut une autre solution

// Solution hybride :
// 1. Vercel Edge → utiliser request.geo.country (gratuit, pas de quota)
// 2. Node.js → utiliser une DB GeoLite2 locale (MaxMind)

import { readFileSync } from "fs"
import { join } from "path"

let geoDb: any = null

async function getGeoDb() {
  if (!geoDb) {
    try {
      const maxmind = await import("maxmind")
      const dbPath = join(process.cwd(), "public", "GeoLite2-Country.mmdb")
      geoDb = await maxmind.open(dbPath)
    } catch {
      return null
    }
  }
  return geoDb
}

export async function getCountry(ip: string): Promise<string | null> {
  try {
    const db = await getGeoDb()
    if (db) {
      const result = db.get(ip)
      return result?.country?.iso_code ?? null
    }
    return null
  } catch {
    return null
  }
}
```

#### Étape 2 — Télécharger la base GeoLite2
```bash
# À faire manuellement ou via un script de build
curl -L -o public/GeoLite2-Country.mmdb \
  "https://git.io/GeoLite2-Country.mmdb"
```

#### Étape 3 — Fallback sur `request.geo` (Edge)
```typescript
// Dans la route API route.ts
export async function GET(req: Request) {
  const geo = (req as any).geo?.country // Vercel Edge uniquement
  
  if (geo) {
    // Utiliser directement, pas besoin d'appel externe
  }
}
```

### Critères d'acceptation
- [ ] La géolocalisation ne fait plus d'appel HTTP externe synchrone
- [ ] Le redirect QR n'est pas bloqué par la géolocalisation
- [ ] Les pays sont correctement identifiés (test avec une IP connue)
- [ ] Fallback gracieux si la base GeoLite2 n'est pas disponible

### Estimation : **M** (1-2 jours)

---

## 3.5 Ajouter un health check endpoint

**🟡 Moyen — Permet aux orchestrateurs de savoir si l'app est ready.**

### Objectif
Créer un endpoint `/api/health` (liveness) et `/api/health/ready` (readiness) qui vérifient : connexion DB, Stripe, Resend.

### Fichiers à créer/modifier
| Fichier | Action |
|---|---|
| `src/app/api/health/route.ts` | Créer |
| `src/app/api/health/ready/route.ts` | Créer |

### Étapes

#### Étape 1 — Créer l'endpoint de liveness
```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
  })
}
```

#### Étape 2 — Créer l'endpoint de readiness
```typescript
// src/app/api/health/ready/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import Stripe from "stripe"

export async function GET() {
  const checks: Record<string, { status: string; error?: string }> = {}

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: "ok" }
  } catch (e) {
    checks.database = { status: "error", error: String(e) }
  }

  // Check Stripe (optionnel, seulement si configuré)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      await stripe.balance.retrieve()
      checks.stripe = { status: "ok" }
    } catch (e) {
      checks.stripe = { status: "error", error: String(e) }
    }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "ok")

  return NextResponse.json(
    { status: allHealthy ? "ok" : "degraded", checks },
    { status: allHealthy ? 200 : 503 }
  )
}
```

### Critères d'acceptation
- [ ] `GET /api/health` retourne 200 avec un JSON simple
- [ ] `GET /api/health/ready` vérifie DB et Stripe
- [ ] Si Stripe est down, l'endpoint retourne 503 (degraded)
- [ ] Les health checks sont exclus du middleware auth

### Estimation : **XS** (1-2 heures)

---

## 3.6 Mettre en place un logger structuré

**🟡 Moyen — Impossible d'agréger les logs en production.**

### Contexte
Les logs sont actuellement des `console.log` ou sont silencieux (catch() vides). Pas de format structuré, pas de niveaux, pas de corrélation.

### Objectif
Installer un logger structuré (pino) et instrumenter les points clés.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `package.json` | Ajouter `pino` |
| `src/lib/logger.ts` | Créer |
| `src/server/services/*.ts` | Remplacer console.log par logger.info/error/warn |

### Étapes

#### Étape 1 — Créer le logger
```typescript
// src/lib/logger.ts
import pino from "pino"

const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "password", "token"],
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export default logger
```

#### Étape 2 — Ajouter un ID de corrélation
```typescript
// Dans le middleware.ts
import { v4 as uuidv4 } from "uuid"

// Ajouter un header X-Request-ID
const requestId = request.headers.get("X-Request-ID") ?? uuidv4()
const response = NextResponse.next()
response.headers.set("X-Request-ID", requestId)

// Stocker dans async local storage ou passer dans le contexte
```

#### Étape 3 — Remplacer les logs silencieux
```typescript
// Avant
emailService.sendInvitationEmail(...).catch(() => {
  /* already logged in emailService */
})

// Après
emailService.sendInvitationEmail(...).catch((error) => {
  logger.error({ error, email }, "Échec envoi email invitation")
})
```

### Critères d'acceptation
- [ ] Les logs sont en format JSON en production
- [ ] Les mots de passe, tokens, cookies sont masqués
- [ ] Chaque requête a un ID de corrélation (X-Request-ID)
- [ ] Les niveaux (debug, info, warn, error) sont respectés
- [ ] Les catch() silencieux loggent l'erreur

### Estimation : **S** (1 jour)

---

## 3.7 Ajouter les contraintes de longueur sur les colonnes

**🟢 Faible — Empêche les valeurs aberrantes en base.**

### Contexte
Les colonnes `email`, `name`, `image`, `destinationUrl` n'ont pas de limite de taille définie en base.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter `@db.VarChar(n)` sur les colonnes concernées |

### Étapes

#### Étape 1 — Ajouter les contraintes
```prisma
model User {
  email    String  @unique @db.VarChar(255)
  name     String? @db.VarChar(100)
  image    String? @db.VarChar(500)
}

model QRCode {
  destinationUrl String? @db.VarChar(2048)
  shortCode      String  @unique @db.VarChar(6)
  name           String  @db.VarChar(100)
  wifiSsid       String? @db.VarChar(100)
  wifiPassword   String? @db.VarChar(100)
  wifiEncryption String? @db.VarChar(10)
  frameType      String? @db.VarChar(50)
  frameLabel     String? @db.VarChar(50)
}
```

#### Étape 2 — Générer la migration
```bash
npx prisma migrate dev --name add-column-length-constraints
```

### Critères d'acceptation
- [ ] Les colonnes ont des limites de taille définies
- [ ] La migration n'échoue pas sur les données existantes
- [ ] `npm run typecheck` passe

### Estimation : **XS** (1 heure)

---

## 3.8 Envelopper recordScan et acceptInvitation dans des transactions

**🟡 Moyen — Risque d'incohérence des données.**

### Contexte
`recordScan` fait INSERT + 2 UPDATE sans transaction. `acceptInvitation` fait INSERT + UPDATE sans transaction. Un crash entre les opérations laisse les données dans un état incohérent.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/server/services/analytics.service.ts` | Wrapper `recordScan` dans une transaction |
| `src/server/services/team.service.ts` | Wrapper `acceptInvitation` dans une transaction |

### Étapes

#### Étape 1 — Transaction pour recordScan
```typescript
// src/server/services/analytics.service.ts
async recordScan(data: ScanInput): Promise<void> {
  const ipHash = data.ip ? hashIp(data.ip) : null
  let country: string | null = null
  if (data.ip) { /* géolocalisation */ }

  await prisma.$transaction(async (tx) => {
    // 1. Créer le scan
    await tx.scan.create({
      data: {
        qrCodeId: data.qrCodeId,
        ipHash, country,
        deviceType: data.userAgent ? parseDevice(data.userAgent) : null,
        os: data.userAgent ? parseOs(data.userAgent) : null,
        browser: data.userAgent ? parseBrowser(data.userAgent) : null,
        referer: data.referer ?? null,
      },
    })

    // 2. Incrémenter totalScans
    await tx.qRCode.update({
      where: { id: data.qrCodeId },
      data: { totalScans: { increment: 1 }, lastScannedAt: new Date() },
    })

    // 3. Incrémenter uniqueScans (si nouveau visiteur)
    if (ipHash) {
      const recentScan = await tx.scan.findFirst({
        where: {
          qrCodeId: data.qrCodeId,
          ipHash,
          scannedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { scannedAt: 'desc' },
      })

      if (!recentScan) {
        await tx.qRCode.update({
          where: { id: data.qrCodeId },
          data: { uniqueScans: { increment: 1 } },
        })
      }
    }
  })
}
```

#### Étape 2 — Transaction pour acceptInvitation
```typescript
// src/server/services/team.service.ts
async acceptInvitation(token: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const invitation = await tx.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: { select: { name: true } } },
    })

    if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt) {
      throw new TRPCError({
        code: invitation ? "PRECONDITION_FAILED" : "NOT_FOUND",
        message: !invitation ? "Invitation introuvable" : "Invitation expirée ou déjà acceptée",
      })
    }

    await tx.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
    })

    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    })
  })

  return { success: true }
}
```

### Critères d'acceptation
- [ ] Un crash pendant `recordScan` ne laisse pas les compteurs désynchronisés
- [ ] Un crash pendant `acceptInvitation` ne crée pas un membre sans marquer l'invitation
- [ ] Les transactions rollbackent correctement en cas d'erreur

### Tests
- **Unitaire (mock) :** Injecter une erreur au milieu de la transaction → vérifier que l'état initial est restauré

### Estimation : **S** (1 jour)

---

## 3.9 Ajouter un index sur LandingPage.createdAt

**🟢 Faible — Optimisation des requêtes de landing pages.**

### Objectif
Ajouter un index pour les requêtes de tri par date de création.

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter `@@index([createdAt])` |

### Étapes

#### Étape 1 — Ajouter l'index
```prisma
model LandingPage {
  // ...
  @@index([createdAt])
}
```

#### Étape 2 — Migrer
```bash
npx prisma migrate dev --name add-landingpage-createdat-index
```

### Estimation : **XS** (30 minutes)

---

# Horizon 6 mois — Évolution

## 4.1 Refondre le pipeline analytics

**🔴 Critique à long terme — Architecture actuelle ne passera pas à l'échelle.**

### Approche
1. **File de messages** (déjà fait en Sprint 2 avec `recordScan` asynchrone)
2. **Agrégation SQL** (déjà fait en Sprint 2 avec GROUP BY)
3. **Cache Redis** : Mettre en cache les résultats analytics (TTL 5 minutes)
4. **Materialized views** : Pour le dashboard, pré-calculer les stats quotidiennes

### Architecture cible
```
Scan → Queue (PgBoss) → Worker → PostgreSQL
                                      ↓
                              Materialized View (daily rollup)
                                      ↓
                              Redis Cache (5 min TTL)
                                      ↓
                              API → Frontend
```

### Fichiers concernés
- `src/server/services/analytics.service.ts` — Réécriture complète
- `src/server/jobs/daily-rollup.ts` — Nouveau
- `prisma/migrations/` — Materialized view

### Estimation : **XL** (3-4 semaines)

---

## 4.2 Partitionner la table Scan par mois

**🟠 Haut — 1M+ lignes rendent les requêtes lentes.**

### Approche
Utiliser le partitionnement natif PostgreSQL (table inheritance ou déclarative).

```sql
CREATE TABLE scan (
  id TEXT,
  qr_code_id TEXT,
  scanned_at TIMESTAMPTZ,
  -- ... autres colonnes ...
) PARTITION BY RANGE (scanned_at);

CREATE TABLE scan_2026_01 PARTITION OF scan
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Avertissement :** Le partitionnement natif PostgreSQL nécessite des migrations dédiées (pas via Prisma) et un script de maintenance pour créer les partitions futures.

### Estimation : **L** (2-3 semaines)

---

## 4.3 Migrer les colonnes type-dépendantes QRCode vers JSONB

**🟠 Haut — Le modèle actuel ne scale pas avec l'ajout de nouveaux types QR.**

### Approche
Remplacer 7 colonnes optionnelles (`wifiSsid`, `wifiPassword`, `vcardJson`, etc.) par une colonne JSONB `metadata`.

```prisma
model QRCode {
  // Supprimer : wifiSsid, wifiPassword, wifiEncryption, vcardJson, textContent, frameType, frameLabel
  // Ajouter :
  metadata Json?  @db.JsonB
}
```

**Migration :**
1. Ajouter la colonne `metadata` nullable
2. Backfill : pour chaque QR code, construire le JSON à partir des anciennes colonnes
3. Mettre à jour le code pour lire/écrire `metadata` au lieu des colonnes individuelles
4. Supprimer les anciennes colonnes (dans une migration séparée)

### Estimation : **L** (2-3 semaines)

---

## 4.4 Ajouter des tests de concurrence

**🟡 Moyen — Race conditions non testées.**

### Zones à couvrir
- `checkPlanLimit` : 2 créations simultanées
- `invite` : 2 invitations simultanées
- `recordScan` : 2 scans simultanés
- `updateStatus` : 2 updates simultanés

### Approche
```typescript
// tests/unit/services/qr.service.concurrency.test.ts
import { describe, it, expect } from "vitest"

describe("qrService.checkPlanLimit - concurrency", () => {
  it("should not exceed limit under concurrent requests", async () => {
    const results = await Promise.allSettled([
      qrService.create({ ... }),
      qrService.create({ ... }),
      qrService.create({ ... }), // Au-delà de la limite FREE
    ])
    
    const successes = results.filter(r => r.status === "fulfilled").length
    expect(successes).toBeLessThanOrEqual(5) // Limite FREE
  })
})
```

### Estimation : **M** (1-2 semaines)

---

## 4.5 Ajouter MFA/TOTP pour l'authentification

**🟡 Moyen — Renforce la sécurité des comptes.**

### Approche
```bash
npm install otplib qrcode
```

1. Ajouter un champ `totpSecret` et `totpEnabled` sur User
2. Créer une page de configuration MFA dans Settings
3. Ajouter une étape de vérification TOTP après le login credentials
4. Support des codes de récupération (10 codes générés, stockés hashés)

### Estimation : **M** (1-2 semaines)

---

## 4.6 Refondre le modèle Workspace

**🟡 Moyen — Redondance ownerId + WorkspaceMember.OWNER.**

### Approche
1. Supprimer `Workspace.ownerId`
2. Ajouter une contrainte : un seul `WorkspaceMember` avec `role === 'OWNER'` par workspace
3. Migration : copier les données `ownerId` → `WorkspaceMember(role=OWNER)`
4. Mettre à jour tous les accès à `workspace.owner` → `workspace.members.find(m => m.role === 'OWNER')`

**Avantage :** Un workspace peut changer de propriétaire sans modifier la table Workspace. Préparation pour la copropriété.

### Estimation : **M** (1-2 semaines)

---

## 4.7 Implémenter le soft-delete pour les QR codes

**🟡 Moyen — Suppression irréversible, pas de corbeille.**

### Approche
1. Ajouter `deletedAt DateTime?` sur QRCode
2. Modifier toutes les requêtes `findMany` pour filtrer `deletedAt: null`
3. Créer un helper `findActive()` qui filtre automatiquement
4. Créer une page "Corbeille" avec possibilité de restauration (30 jours)
5. Job de purge définitive après 30 jours

### Estimation : **M** (1-2 semaines)

---

# Checklist de validation

Avant chaque déploiement :

## Qualité
- [ ] `npm run typecheck` passe (zéro erreur TypeScript)
- [ ] `npm run lint` passe (zéro warning ESLint)
- [ ] `npm run test` passe (tous les tests verts)
- [ ] Coverage > 80% sur les nouveaux services

## Sécurité
- [ ] Aucun secret en dur dans le code
- [ ] CSP mis à jour si nouvelles ressources externes
- [ ] `npm audit` ne rapporte pas de vulnérabilité critique
- [ ] Les mots de passe et tokens ne sont pas loggés

## Données
- [ ] Les migrations Prisma sont backward-compatible
- [ ] Les nouveaux index sont testés avec `EXPLAIN ANALYZE`
- [ ] Les transactions couvrent les opérations multi-tables

## Performance
- [ ] Les nouvelles requêtes analytics utilisent GROUP BY SQL (pas d'aggrégation JS)
- [ ] Les endpoints de liste sont paginés
- [ ] Les appels externes ont timeout + retry

## Production
- [ ] Les health checks sont déployés
- [ ] Le rate limiting distribué est configuré
- [ ] Les variables d'environnement sont documentées dans `.env.example`

---

# Architecture des tests

## Structure des dossiers de tests
```
tests/
├── unit/
│   ├── lib/           # Tests des utilitaires
│   ├── services/      # Tests des services (mocks Prisma)
│   └── hooks/         # Tests des hooks React
├── integration/
│   └── routers/       # Tests tRPC (withPrismaTest)
└── e2e/
    ├── auth.spec.ts
    ├── qr-crud.spec.ts
    ├── qr-list.spec.ts       # ← NOUVEAU (pour la liste QR codes)
    └── team-invite.spec.ts
```

## Outils recommandés
- **Vitest** : Tests unitaires et d'intégration
- **Playwright** : Tests E2E
- **Prisma mocking** : Utiliser `vi.mock` avec un mock PrismaClient (déjà existant)
- **TestContainers** : Pour les tests d'intégration avec vraie base PostgreSQL (optionnel)

---

> **Document généré le 3 juin 2026**
> **Basé sur :** `REVIEW.md` — Revue complète par 24 agents spécialisés
> **Prochaine étape :** Démarrer le Sprint 1 — Correctifs critiques
