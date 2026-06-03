import { router } from "@/server/trpc"
import { authRouter } from "@/server/routers/auth"
import { qrRouter } from "@/server/routers/qr"
import { teamRouter } from "@/server/routers/team"
import { billingRouter } from "@/server/routers/billing"
import { apiKeyRouter } from "@/server/routers/apiKey"

export const appRouter = router({
  auth: authRouter,
  qr: qrRouter,
  team: teamRouter,
  billing: billingRouter,
  apiKey: apiKeyRouter,
})

export type AppRouter = typeof appRouter
