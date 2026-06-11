"use client"

import { useState, useCallback, useRef, type ReactNode, type DragEvent } from "react"

/**
 * Animated card grid with staggered entrance and drag-to-reorder.
 *
 * - Each card gets a CSS `--i` for staggered entrance (50ms deltas).
 * - The grid key is derived from `filterKey` so cards re-animate on filter change.
 * - Drag handles use native HTML5 DnD API (no library dependency).
 * - Order resets between sessions (no backend change needed).
 */

interface QRCardGridProps {
  children: ReactNode[]
  filterKey?: string
  onReorder?: (fromIndex: number, toIndex: number) => void
  className?: string
}

export function QRCardGrid({
  children,
  filterKey = "",
  onReorder,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: QRCardGridProps) {
  const [items, setItems] = useState(children)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  // Keep a stable render key that changes on filter/page changes
  const renderPrefix = useRef(filterKey)
  const [renderKey, setRenderKey] = useState(`${filterKey}-${children.length}`)

  // Sync when children reference changes
  const prevChildren = useRef(children)
  if (children !== prevChildren.current) {
    prevChildren.current = children
    renderPrefix.current = filterKey
    setRenderKey(`${filterKey}-${children.length}`)

    // Preserve user's reorder if children count matches, otherwise reset
    if (items.length !== children.length) {
      setItems(children)
    }
  }

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number) => {
      dragItem.current = index
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", String(index))
    },
    [],
  )

  const handleDragEnter = useCallback(
    (_e: DragEvent<HTMLDivElement>, index: number) => {
      dragOverItem.current = index
    },
    [],
  )

  const handleDragEnd = useCallback(
    () => {
      if (dragItem.current === null || dragOverItem.current === null) return
      if (dragItem.current === dragOverItem.current) {
        dragItem.current = null
        dragOverItem.current = null
        return
      }

      const from = dragItem.current
      const to = dragOverItem.current

      setItems((prev) => {
        const updated = [...prev]
        const [moved] = updated.splice(from, 1)
        updated.splice(to, 0, moved)
        return updated
      })

      onReorder?.(from, to)

      dragItem.current = null
      dragOverItem.current = null
    },
    [onReorder],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  return (
    <div
      key={renderKey}
      role="list"
      aria-label="Liste des QR codes"
      className={className}
      onDragOver={handleDragOver}
    >
      {items.map((child, index) => (
        <div
          key={`card-${index}`}
          role="listitem"
          style={{ "--i": index } as React.CSSProperties}
          className="animate-fade-slide-up"
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnter={(e) => handleDragEnter(e, index)}
          onDragEnd={handleDragEnd}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
