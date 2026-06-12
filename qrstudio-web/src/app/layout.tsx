import type { Metadata } from "next"
import { Inter, Geist } from "next/font/google"
import "./globals.css"
import * as Sentry from "@sentry/nextjs"
import { cn } from "@/lib/utils"
import { TRPCProvider } from "@/components/shared/trpc-provider"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

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
      className={cn("h-full", inter.variable, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
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
