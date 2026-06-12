---
target: qrstudio-web/src/app
total_score: 31
p0_count: 1
p1_count: 2
timestamp: 2026-06-12T14-38-40Z
slug: qrstudio-web-src-app
---
# Critique Design — QrStudio

## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|-------------|-------|-------------|
| 1 | Visibilité de l'état du système | 4/4 | Skeletons, toasts, confirmations — excellent |
| 2 | Correspondance système-réel | 4/4 | Français fluide, conventions familières |
| 3 | Contrôle et liberté utilisateur | 3/4 | Pas de fil d'Ariane, pas d'undo sur modifications |
| 4 | Cohérence et standards | 4/4 | Design system appliqué sans faille |
| 5 | Prévention des erreurs | 3/4 | Validation Zod, confirmation destruction |
| 6 | Reconnaissance vs rappel | 3/4 | Indicateur d'étape, états vides — pas de pagination |
| 7 | Flexibilité et efficacité | 2/4 | Aucun raccourci clavier, aucune action groupée |
| 8 | Design esthétique et minimaliste | 4/4 | Monochrome exécuté magnifiquement |
| 9 | Aide à la récupération d'erreur | 3/4 | Toasts descriptifs — mais error.tsx générique |
| 10 | Aide et documentation | 1/4 | Zéro — pas de FAQ, pas d'aide, pas de docs |
| **Total** | | **31/40** | **Bon — solide, plafonné par aide et efficacité** |

## Anti-Patterns Verdict

Aucun gradient text, glassmorphism, side-stripe borders, hero-metrics, eyebrows uppercase, ou numbered markers. La discipline monochrome est tenue rigidement. L'interface a l'air pensée par un humain.

## Charge Cognitive

0 échecs sur 8 — faible charge cognitive. Focus unique, chunking (wizard 4 étapes), regroupement logique, hiérarchie visuelle claire, divulgation progressive.

## Ce qui fonctionne

1. Fidélité monochrome exemplaire — design system appliqué sans dérive
2. États de chargement robustes — skeletons dimensionnés, toasts avec annulation
3. Prévention des erreurs en zone dangereuse — confirmation destruction, 'taper supprimer'

## Problèmes Prioritaires

### P0 — Aucune documentation d'aide nulle part
Pas de page d'aide, FAQ, ou aide contextuelle. Un primo-accédant ne peut pas apprendre le produit.

### P1 — Aucun raccourci clavier ni action groupée
Pas de palette de commandes, pas de sélection en masse, pas d'actions batch. La marque promet 'efficace' mais ne livre pas.

### P1 — Pagination invisible
'Voir plus' sans indicateur de total ou position. L'utilisateur ignore s'il a 3 ou 300 QR.

### P2 — Paiement sans aperçu
Redirection Stripe immédiate sans récapitulatif ni message de transition.

### P2 — Onboarding tableau de bord vide
L'empty state accueille mais n'éduque pas sur la valeur des QR dynamiques.

## Persona Red Flags

**Alex (Power User)**: Abandonne — aucun raccourci, aucune action batch.
**Jordan (First-Timer)**: Bloque sur l'absence totale d'aide.
**Sam (Accessibilité)**: Bon global — faiblesse : pagination infinie muette pour lecteurs d'écran.

## Questions

1. Vous vendez à des professionnels mais n'offrez aucune fonctionnalité de rapidité — est-ce intentionnel ?
2. Le sélecteur de type QR (7 cartes identiques) viole les Don't du design system — choix délibéré ?
3. 4 pages d'erreur mais 0 page d'aide — pourquoi cette asymétrie ?
