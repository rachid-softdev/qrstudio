import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import {
  checkQrRateLimit,
  checkAuthRateLimit,
  checkTrpcMutationLimit,
  checkTrpcQueryLimit,
} from "@/lib/rate-limit"

const authRoutes = ["/login", "/register"]
const publicPrefixes = [
  "/api/qr/",
  "/api/auth/",
  "/api/webhooks/",
  "/api/health/",
  "/api/uploadthing/",
  "/invite/",
  "/l/",
  "/view/",
]

function addRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("X-Request-ID", requestId)
  return response
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const url = request.nextUrl.pathname
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  if (url.startsWith("/api/v1/")) {
    const newUrl = url.replace("/api/v1/", "/api/")
    const requestUrl = new URL(newUrl, request.url)
    return addRequestId(NextResponse.rewrite(requestUrl), requestId)
  }

  if (url.startsWith("/api/qr/")) {
    const { success, remaining } = await checkQrRateLimit(ip)
    if (!success) {
      const resp = new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      })
      return addRequestId(resp, requestId)
    }
    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return addRequestId(response, requestId)
  }

  if (["/login", "/register"].includes(url)) {
    const { success } = await checkAuthRateLimit(ip)
    if (!success) {
      const resp = new NextResponse("Trop de tentatives. Réessayez dans une heure.", {
        status: 429,
        headers: { "Retry-After": "3600" },
      })
      return addRequestId(resp, requestId)
    }
  }

  // Rate limiting for tRPC API
  if (url.startsWith("/api/trpc/")) {
    const limiterFn =
      request.method === "POST" ? checkTrpcMutationLimit : checkTrpcQueryLimit
    const { success, remaining } = await limiterFn(ip)
    if (!success) {
      const resp = new NextResponse(
        JSON.stringify({ error: "Too Many Requests" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        }
      )
      return addRequestId(resp, requestId)
    }
    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return addRequestId(response, requestId)
  }

  // Skip middleware for public prefixes (API, webhooks, invite links, etc.)
  const isPublicPrefix = publicPrefixes.some((prefix) =>
    url.startsWith(prefix)
  )
  if (isPublicPrefix) {
    return addRequestId(NextResponse.next(), requestId)
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isAuthenticated = !!token

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authRoutes.includes(url)) {
    return addRequestId(NextResponse.redirect(new URL("/dashboard", request.url)), requestId)
  }

  // Redirect unauthenticated users to login
  const isProtectedRoute =
    url === "/dashboard" || url.startsWith("/dashboard/")
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", url)
    return addRequestId(NextResponse.redirect(loginUrl), requestId)
  }

  return addRequestId(NextResponse.next(), requestId)
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    "/api/qr/:path*",
    "/api/trpc/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
}
