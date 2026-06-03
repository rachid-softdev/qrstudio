import { api } from "@/lib/trpc/client"
import type { Period } from "@/lib/validations"

export function useAnalytics(qrId: string, workspaceId: string, period: Period) {
  const { data, isLoading, error } = api.qr.getAnalytics.useQuery(
    { qrCodeId: qrId, workspaceId, period },
    { enabled: !!qrId && !!workspaceId }
  )

  return { data, isLoading, error }
}
