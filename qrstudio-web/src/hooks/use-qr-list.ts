import { api } from "@/lib/trpc/client"
import type { QRType, QRStatus } from "@/types/index"

interface UseQRListFilters {
  workspaceId: string
  type?: QRType
  status?: QRStatus
  search?: string
  limit?: number
}

export function useQRList(filters: UseQRListFilters) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.qr.list.useInfiniteQuery(
      {
        workspaceId: filters.workspaceId,
        limit: filters.limit ?? 20,
        type: filters.type,
        status: filters.status,
        search: filters.search,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      }
    )

  const items = data?.pages.flatMap((page) => page.items) ?? []
  const total = items.length

  return {
    items,
    total,
    nextCursor: data?.pages[data.pages.length - 1]?.nextCursor,
    isLoading,
    isFetchingNextPage,
    error,
    fetchMore: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
  }
}
