"use client"

import { type ReactNode, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: ReactNode
}

interface FAQSectionProps {
  items: FAQItem[]
  title?: string
}

function FAQItem({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <details
      className="group border-b last:border-b-0"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:text-primary list-none [&::-webkit-details-marker]:hidden"
        aria-expanded={open}
      >
        <span>{item.question}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
        {item.answer}
      </div>
    </details>
  )
}

export function FAQSection({ items, title }: FAQSectionProps) {
  if (!items.length) return null

  return (
    <div>
      {title && (
        <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {items.map((item, i) => (
          <FAQItem key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}
