"use client"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

interface StepIndicatorProps {
  currentStep: number
  steps: { label: string }[]
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <>
      {/* Horizontal layout — desktop */}
      <div className="hidden sm:flex sm:items-center sm:justify-center sm:gap-2">
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
                    "text-sm",
                    (isActive || isCompleted) ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px w-8",
                    stepNumber < currentStep ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Vertical layout — mobile */}
      <ol className="flex flex-col gap-0 sm:hidden" aria-label="Progression">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep

          return (
            <li key={step.label} className="flex gap-3">
              {/* Connecting bar + circle */}
              <div className="flex flex-col items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "h-2 w-0.5",
                      stepNumber <= currentStep ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "border-2 border-primary bg-primary/10 text-primary",
                    !isActive && !isCompleted && "border border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    stepNumber
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-full w-0.5 min-h-8",
                      stepNumber < currentStep ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
              {/* Label */}
              <div className="flex flex-col justify-center pb-6 last:pb-0">
                <span
                  className={cn(
                    "text-sm",
                    (isActive || isCompleted) ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
