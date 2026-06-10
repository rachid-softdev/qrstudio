"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { useRef, useState } from "react"
import { SessionProvider, useSession } from "next-auth/react"
import superjson from "superjson"
import { api } from "@/lib/trpc/client"

function getBaseUrl() {
  if (typeof window !== "undefined") return ""
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

function TRPCProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const csrfTokenRef = useRef("")
  csrfTokenRef.current = (session as { csrfToken?: string } | undefined)?.csrfToken ?? ""

  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {
              "x-csrf-token": csrfTokenRef.current,
            }
          },
        }),
      ],
    })
  )

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </api.Provider>
  )
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProviderInner>{children}</TRPCProviderInner>
    </SessionProvider>
  )
}
