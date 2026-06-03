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
