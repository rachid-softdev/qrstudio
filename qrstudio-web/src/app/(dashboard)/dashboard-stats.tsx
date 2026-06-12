import { analyticsService } from "@/server/services/analytics.service"
import { DashboardStatsClient } from "./dashboard-stats-client"

interface DashboardStatsProps {
  workspaceId: string
}

export async function DashboardStats({ workspaceId }: DashboardStatsProps) {
  const stats = await analyticsService.getDashboardStats(workspaceId)
  return <DashboardStatsClient initialData={stats} />
}
