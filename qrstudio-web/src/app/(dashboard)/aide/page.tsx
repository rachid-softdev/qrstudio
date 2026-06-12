import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FAQSection } from "@/components/shared/faq-section"
import { Card, CardContent } from "@/components/ui/card"
import { MailIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Aide — QR Studio",
  description: "Questions fréquentes et documentation QR Studio",
}

const faqGeneralites = [
  {
    question: "Qu'est-ce qu'un QR code dynamique ?",
    answer: (
      <>
        <p>
          Un QR code dynamique fonctionne comme une redirection intelligente. Le code
          imprimé contient une courte URL qui pointe vers vos contenus (site web, page
          de renvoi, document PDF…). Vous pouvez modifier la destination à tout moment
          sans réimprimer le QR code.
        </p>
        <p className="mt-2">
          C'est la différence fondamentale avec un QR code statique, qui encode
          directement l'information et ne peut plus être modifié une fois imprimé.
        </p>
      </>
    ),
  },
  {
    question: "Quelle est la différence entre un QR code statique et dynamique ?",
    answer: (
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Statique</strong> : la donnée est encodée directement dans le code. Impossible à modifier après impression. Pas de statistiques de scan.</li>
        <li><strong>Dynamique</strong> : le code pointe vers une courte URL. Vous pouvez changer la destination, suivre les scans en temps réel, et le désactiver si nécessaire.</li>
      </ul>
    ),
  },
  {
    question: "Que se passe-t-il quand je mets un QR code en pause ?",
    answer: (
      <p>
        Le QR code devient inactif. Les utilisateurs qui le scannent sont redirigés
        vers une page d&apos;information indiquant que le contenu est momentanément
        indisponible. Les scans ne sont plus comptabilisés pendant cette période.
        Vous pouvez le réactiver à tout moment depuis le tableau de bord.
      </p>
    ),
  },
  {
    question: "Les QR codes expireront-ils un jour ?",
    answer: (
      <p>
        Non. Contrairement à des offres concurrentes, les QR codes créés dans QR Studio
        restent actifs même après résiliation de votre abonnement. Seules les
        analytics peuvent être limitées à la période de rétention de votre plan.
      </p>
    ),
  },
]

const faqPlans = [
  {
    question: "Quels sont les limites de chaque plan ?",
    answer: (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 font-medium">Fonctionnalité</th>
              <th className="pb-2 pr-4 font-medium">Gratuit</th>
              <th className="pb-2 pr-4 font-medium">Pro</th>
              <th className="pb-2 font-medium">Agency</th>
            </tr>
          </thead>
          <tbody className="divide-y text-muted-foreground">
            <tr>
              <td className="py-2 pr-4">QR codes</td>
              <td className="py-2 pr-4">5 max</td>
              <td className="py-2 pr-4">100 max</td>
              <td className="py-2">Illimité</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Membres d&apos;équipe</td>
              <td className="py-2 pr-4">1</td>
              <td className="py-2 pr-4">5 max</td>
              <td className="py-2">Illimité</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Rétention analytics</td>
              <td className="py-2 pr-4">30 jours</td>
              <td className="py-2 pr-4">365 jours</td>
              <td className="py-2">Illimitée</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Génération en masse</td>
              <td className="py-2 pr-4">—</td>
              <td className="py-2 pr-4">✓</td>
              <td className="py-2">✓</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Accès API</td>
              <td className="py-2 pr-4">—</td>
              <td className="py-2 pr-4">✓</td>
              <td className="py-2">✓</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Domaine personnalisé</td>
              <td className="py-2 pr-4">—</td>
              <td className="py-2 pr-4">—</td>
              <td className="py-2">✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    question: "Comment passer à un plan supérieur ?",
    answer: (
      <p>
        Rendez-vous sur la page <strong>Facturation</strong> depuis le menu latéral.
        Choisissez le plan qui correspond à vos besoins et suivez les instructions
        de paiement sécurisé via Stripe. Le passage est immédiat.
      </p>
    ),
  },
  {
    question: "Puis-je résilier mon abonnement à tout moment ?",
    answer: (
      <p>
        Oui. Depuis la page Facturation, vous pouvez annuler votre abonnement.
        Votre accès reste valable jusqu&apos;à la fin de la période en cours.
        Après résiliation, vos QR codes restent actifs mais les analytics
        sont limitées à la période de rétention de votre plan.
      </p>
    ),
  },
]

const faqCompte = [
  {
    question: "Comment gérer mon équipe ?",
    answer: (
      <p>
        Depuis la page <strong>Équipe</strong>, vous pouvez inviter des membres par
        email. Trois rôles sont disponibles : <strong>Propriétaire</strong> (accès
        total), <strong>Éditeur</strong> (peut créer et modifier des QR codes),
        et <strong>Observateur</strong> (consultation seule).
      </p>
    ),
  },
  {
    question: "Comment activer l'authentification à deux facteurs (2FA) ?",
    answer: (
      <p>
        Rendez-vous dans <strong>Paramètres → Sécurité</strong>. Cliquez sur
        « Activer la 2FA » et scannez le code QR avec votre application
        d&apos;authentification (Google Authenticator, Authy, 1Password…).
        Une fois activée, un code à usage unique vous sera demandé à chaque
        connexion.
      </p>
    ),
  },
  {
    question: "Comment supprimer mon compte ?",
    answer: (
      <p>
        Dans <strong>Paramètres → Sécurité</strong>, section « Zone de danger ».
        Tapez <strong>supprimer</strong> dans le champ de confirmation puis
        cliquez sur le bouton de suppression. Cette action est irréversible.
        Toutes les données associées à votre compte seront effacées.
      </p>
    ),
  },
  {
    question: "Comment fonctionne l'accès API ?",
    answer: (
      <p>
        Les plans Pro et Agency incluent un accès à l&apos;API REST. Générez vos
        clés depuis <strong>Paramètres → Sécurité</strong>, section
        « Clés API ». Chaque clé possède des permissions configurables
        (lecture seule ou écriture). Ne partagez jamais vos clés API.
      </p>
    ),
  },
]

export default async function AidePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="space-y-8">
      <Header
        title="Aide"
        description="Questions fréquentes et documentation pour tirer le meilleur de QR Studio"
      />

      <FAQSection
        title="Généralités"
        items={faqGeneralites}
      />

      <FAQSection
        title="Plans et facturation"
        items={faqPlans}
      />

      <FAQSection
        title="Compte et équipe"
        items={faqCompte}
      />

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <MailIcon className="size-5 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Vous ne trouvez pas votre réponse ?
            </p>
            <p className="text-sm text-muted-foreground">
              Contactez-nous à{" "}
              <a
                href="mailto:support@qrstudio.app"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                support@qrstudio.app
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
