"use client"

import { cn } from "@/lib/utils"
import { QrCodeIcon } from "lucide-react"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
  className?: string
}

const sizeClasses = {
  sm: "text-lg gap-1.5",
  md: "text-xl gap-2",
  lg: "text-2xl gap-2.5",
}

const iconSizes = {
  sm: "size-5",
  md: "size-6",
  lg: "size-7",
}

export function Logo({ size = "md", showIcon = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center font-bold", sizeClasses[size], className)}>
      {showIcon && <QrCodeIcon className={cn("text-primary", iconSizes[size])} />}
      <span>
        QR<span className="text-primary">Studio</span>
      </span>
    </div>
  )
}
