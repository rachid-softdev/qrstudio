import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const QR_RATE_LIMIT_WINDOW_MS = 60_000
const QR_RATE_LIMIT_MAX = 100

const AUTH_RATE_LIMIT_WINDOW_MS = 3600_000
const AUTH_RATE_LIMIT_MAX = 5

function getRateLimitInfo(
  ip: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count }
}

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

  // Rate limiting for QR code API
  if (url.startsWith("/api/qr/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    const { allowed, remaining } = getRateLimitInfo(ip, QR_RATE_LIMIT_WINDOW_MS, QR_RATE_LIMIT_MAX)

    if (!allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      })
    }

    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return response
  }

  // Rate limiting for auth pages
  if (authRoutes.includes(url)) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown"
    const { allowed } = getRateLimitInfo(ip, AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX)

    if (!allowed) {
      return new NextResponse("Trop de tentatives. Réessayez dans une heure.", {
        status: 429,
        headers: {
          "Retry-After": "3600",
        },
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
