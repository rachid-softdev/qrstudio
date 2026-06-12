import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { TRPCProvider } from "@/components/shared/trpc-provider"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: "QR Studio",
    template: "%s | QR Studio",
  },
  description:
    "Créez, gérez et analysez vos QR codes dynamiques. Les codes qui fonctionnent même après impression.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full", inter.variable, "font-sans")}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Aller au contenu principal
        </a>
        <Sentry.ErrorBoundary fallback={<p>Une erreur est survenue</p>}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TRPCProvider>
              {children}
              <Toaster />
            </TRPCProvider>
          </ThemeProvider>
        </Sentry.ErrorBoundary>
      </body>
    </html>
  )
}
