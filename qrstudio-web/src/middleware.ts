import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { qrRateLimit, authRateLimit } from "@/lib/rate-limit"

const authRoutes = ["/login", "/register"]
const publicPrefixes = [
  "/api/qr/",
  "/api/auth/",
  "/api/webhooks/",
  "/api/uploadthing/",
  "/invite/",
  "/l/",
  "/view/",
]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl.pathname
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

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

  // Skip middleware for public prefixes (API, webhooks, invite links, etc.)
  const isPublicPrefix = publicPrefixes.some((prefix) =>
    url.startsWith(prefix)
  )
  if (isPublicPrefix) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isAuthenticated = !!token

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authRoutes.includes(url)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Redirect unauthenticated users to login
  const isProtectedRoute =
    url === "/dashboard" || url.startsWith("/dashboard/")
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/api/qr/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
}
