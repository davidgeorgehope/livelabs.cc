"use client";

import { cn } from "@/lib/utils";
import { Step } from "@/lib/api";
import { CheckCircle2, Lock, Clock } from "lucide-react";

interface StepListProps {
  steps: Step[];
  currentStep: number;
  selectedStep: number;
  onSelectStep: (order: number) => void;
  estimatedMinutes?: number | null;
}

export function StepList({
  steps,
  currentStep,
  selectedStep,
  onSelectStep,
  estimatedMinutes,
}: StepListProps) {
  const completedSteps = currentStep - 1;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedSteps} of {totalSteps} steps</span>
          {estimatedMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{estimatedMinutes} min
            </span>
          )}
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1">
        {steps.map((step) => {
          const isCompleted = step.order < currentStep;
          const isCurrent = step.order === currentStep;
          const isLocked = step.order > currentStep;
          const isSelected = step.order === selectedStep;

          return (
            <button
              key={step.id}
              onClick={() => !isLocked && onSelectStep(step.order)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm transition-all",
                isSelected && "bg-accent ring-2 ring-primary/20",
                !isSelected && !isLocked && "hover:bg-accent/50",
                isLocked && "opacity-50 cursor-not-allowed",
                isCurrent && !isSelected && "border border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">{step.order}</span>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "block truncate",
                  isCompleted && "text-muted-foreground",
                  isCurrent && "font-medium"
                )}>
                  {step.title}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
