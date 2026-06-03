import { notFound } from "next/navigation"
import { prisma } from "@/server/db"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ shortCode: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shortCode } = await params

  const qrCode = await prisma.qRCode.findUnique({
    where: { shortCode },
    include: { landingPage: true },
  })

  if (!qrCode?.landingPage) {
    return { title: "Page introuvable" }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://qrstudio.app"

  return {
    title: qrCode.landingPage.title,
    description: qrCode.landingPage.description ?? undefined,
    openGraph: {
      title: qrCode.landingPage.title,
      description: qrCode.landingPage.description ?? undefined,
      url: `${appUrl}/l/${shortCode}`,
      images: qrCode.landingPage.imageUrl
        ? [{ url: qrCode.landingPage.imageUrl, width: 1200, height: 630 }]
        : undefined,
    },
  }
}

export default async function LandingPageView({ params }: Props) {
  const { shortCode } = await params

  const qrCode = await prisma.qRCode.findUnique({
    where: { shortCode },
    include: { landingPage: true },
  })

  if (!qrCode || !qrCode.landingPage) {
    notFound()
  }

  const lp = qrCode.landingPage

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-8"
      style={{ backgroundColor: lp.bgColor, color: lp.textColor }}
    >
      <div className="w-full max-w-lg space-y-8 text-center">
        {lp.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lp.imageUrl}
            alt=""
            className="mx-auto max-h-48 rounded-lg object-cover"
          />
        )}

        <h1 className="text-3xl font-bold tracking-tight">{lp.title}</h1>

        {lp.description && (
          <p className="text-lg leading-relaxed opacity-80">{lp.description}</p>
        )}

        {lp.ctaLabel && lp.ctaUrl && (
          <a
            href={lp.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
            style={{
              backgroundColor: lp.textColor,
              color: lp.bgColor,
            }}
          >
            {lp.ctaLabel}
          </a>
        )}
      </div>
    </div>
  )
}
