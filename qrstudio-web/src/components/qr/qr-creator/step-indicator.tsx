"use client"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

interface StepIndicatorProps {
  currentStep: number
  steps: { label: string }[]
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isActive = stepNumber === currentStep
        const isCompleted = stepNumber < currentStep

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "border-2 border-primary bg-primary/10 text-primary",
                  !isActive && !isCompleted && "border border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="size-4" />
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  (isActive || isCompleted) ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "hidden h-px w-8 sm:block",
                  stepNumber < currentStep ? "bg-primary" : "bg-border"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
