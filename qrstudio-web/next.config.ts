import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  serverExternalModules: ["sharp", "prisma"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.uploadthing.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // NOTE: 'unsafe-eval' has been removed — Webpack/Turbopack do not
              // require it in production when appDir is used. If a build failure
              // appears, re-add it and file a ticket to remove it permanently.
              // 'unsafe-inline' is required because Next.js injects inline <script>
              // tags for RSC payload hydration (react-dom, form-state, etc.).
              // This is a known limitation: https://github.com/vercel/next.js/issues/45184
              // Tracked: https://github.com/QrStudio/qrstudio-web/issues/CSP
              "script-src 'self' 'unsafe-inline' https://js.stripe.com https://uploadthing.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://uploadthing.com https://*.uploadthing.com",
              "font-src 'self'",
              "connect-src 'self' https://api.uploadthing.com https://o450816.ingest.sentry.io https://ip-api.com",
              "frame-src 'self' https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "qr-studio",
  project: process.env.SENTRY_PROJECT ?? "qrstudio-web",
  silent: !process.env.CI,
  tunnelRoute: "/sentry-tunnel",
  widenClientFileUpload: true,
})
