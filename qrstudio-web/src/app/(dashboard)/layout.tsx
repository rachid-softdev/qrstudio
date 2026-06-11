import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { Sidebar } from "@/components/layout/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex flex-1 flex-col pt-14 lg:pt-0">
        <div className="flex-1 p-6 lg:p-8">
          <Suspense
            fallback={
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3 rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                        <div className="size-4 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
