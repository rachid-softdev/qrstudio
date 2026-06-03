import { createTRPCContext } from "@/server/trpc"
import { appRouter } from "@/server/routers/_app"

export async function createServerCaller() {
  const ctx = await createTRPCContext()
  return appRouter.createCaller(ctx)
}
