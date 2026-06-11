"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { QrCodeIcon, Trash2Icon } from "lucide-react"
import { api } from "@/lib/trpc/client"
import { useQRList } from "@/hooks/use-qr-list"
import { QRCard } from "@/components/qr/qr-card"
import { QRCardGrid } from "@/components/qr/qr-card-grid"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/loading-skeleton"
import { Button } from "@/components/ui/button"
import { QRListFilters } from "@/components/qr/qr-list-filters"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { toast } from "sonner"
import type { QRType, QRStatus } from "@/types"

interface QRCodeListClientProps {
  workspaceId: string
}

export function QRCodeListClient({ workspaceId }: QRCodeListClientProps) {
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<QRType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<QRStatus | "all">("all")
  const [trashFilter, setTrashFilter] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value)
    }, 400)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const { items, isLoading, isFetchingNextPage, error, fetchMore, nextCursor } =
    useQRList({
      workspaceId,
      search: debouncedSearch || undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      trash: trashFilter,
    })

  const utils = api.useUtils()

  const deleteMutation = api.qr.delete.useMutation()

  const restoreMutation = api.qr.restore.useMutation({
    onSuccess: () => {
      utils.qr.list.invalidate()
      toast.success("QR code restauré")
    },
  })

  const permanentDeleteMutation = api.qr.permanentDelete.useMutation({
    onSuccess: () => {
      utils.qr.list.invalidate()
      toast.success("QR code supprimé définitivement")
    },
  })

  const updateStatusMutation = api.qr.updateStatus.useMutation({
    onSuccess: () => {
      utils.qr.list.invalidate()
    },
  })

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({ id, workspaceId }, {
        onSuccess: () => {
          utils.qr.list.invalidate()
          toast("QR code déplacé dans la corbeille", {
            action: {
              label: "Annuler",
              onClick: () => {
                restoreMutation.mutate({ id, workspaceId })
              },
            },
            duration: 5000,
          })
        },
      })
    },
    [deleteMutation, restoreMutation, utils, workspaceId],
  )

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate({ id, workspaceId })
    },
    [restoreMutation, workspaceId],
  )

  const handlePermanentDelete = useCallback(
    (id: string) => {
      setPendingDeleteId(id)
    },
    [],
  )

  const handleToggleStatus = useCallback(
    (id: string, status: QRStatus) => {
      updateStatusMutation.mutate({ id, workspaceId, status })
    },
    [updateStatusMutation, workspaceId],
  )

  // Derive a filter key so the grid re-animates when filters change
  const filterKey = JSON.stringify({ type: typeFilter, status: statusFilter, trash: trashFilter, search: debouncedSearch })

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-destructive">
          Une erreur est survenue lors du chargement des QR codes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <QRListFilters
        search={searchInput}
        onSearchChange={handleSearchChange}
        type={typeFilter}
        onTypeChange={setTypeFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        trash={trashFilter}
        onTrashChange={setTrashFilter}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        trashFilter ? (
          <EmptyState
            icon={Trash2Icon}
            title="Corbeille vide"
            description="Aucun QR code dans la corbeille."
          />
        ) : (
          <EmptyState
            icon={QrCodeIcon}
            title="Aucun QR code"
            description="Créez votre premier QR code pour commencer."
            action={{
              label: "Créer un QR code",
              href: "/dashboard/qr/new",
            }}
          />
        )
      ) : (
        <QRCardGrid filterKey={filterKey}>
          {items.map((qr) => (
            <QRCard
              key={qr.id}
              id={qr.id}
              name={qr.name}
              shortCode={qr.shortCode}
              type={qr.type as QRType}
              status={qr.status as QRStatus}
              totalScans={qr.totalScans}
              createdAt={qr.createdAt}
              role="OWNER"
              trash={trashFilter}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </QRCardGrid>
      )}

      {nextCursor && !isLoading && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMore()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Chargement..." : "Voir plus"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        title="Supprimer définitivement ?"
        description="Êtes-vous sûr de vouloir supprimer définitivement ce QR code ? Cette action est irréversible et supprimera également les pages de destination et les statistiques associées."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="destructive"
        onConfirm={() => {
          if (pendingDeleteId) {
            permanentDeleteMutation.mutate({ id: pendingDeleteId, workspaceId })
            setPendingDeleteId(null)
          }
        }}
        isPending={permanentDeleteMutation.isPending}
      />
    </div>
  )
}
