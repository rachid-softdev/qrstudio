"use client"

import type { ReactNode } from "react"
import { PageHeader } from "@/components/shared/page-header"

interface HeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="mb-8">
      <PageHeader title={title} description={description} actions={actions} />
    </header>
  )
}
