import { z } from "zod"
import { router, protectedProcedure } from "@/server/trpc"
import { prisma } from "@/server/db"

export const workspaceRouter = router({
  getStats: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input }) => {
      const stats = await prisma.workspaceQRStats.findUnique({
        where: { workspaceId: input.workspaceId },
      })
      if (!stats) {
        // No stats yet — trigger a refresh
        return {
          totalQRCount: 0,
          activeCount: 0,
          pausedCount: 0,
          urlCount: 0,
          landingCount: 0,
          otherCount: 0,
          totalScans: 0,
        }
      }
      return stats
    }),
})
