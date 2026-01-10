"use client";

import { cn } from "@/lib/utils";
import { Step } from "@/lib/api";
import { CheckCircle2, Circle, Lock } from "lucide-react";

interface StepListProps {
  steps: Step[];
  currentStep: number;
  selectedStep: number;
  onSelectStep: (order: number) => void;
}

export function StepList({
  steps,
  currentStep,
  selectedStep,
  onSelectStep,
}: StepListProps) {
  return (
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
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
              isSelected && "bg-accent",
              !isSelected && !isLocked && "hover:bg-accent/50",
              isLocked && "opacity-50 cursor-not-allowed"
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : isCurrent ? (
              <Circle className="h-5 w-5 text-primary flex-shrink-0" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
            <span className={cn(isCompleted && "text-muted-foreground")}>
              {step.order}. {step.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
