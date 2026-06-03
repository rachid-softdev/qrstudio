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
              <div className="space-y-4">
                <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-xl bg-muted"
                    />
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
