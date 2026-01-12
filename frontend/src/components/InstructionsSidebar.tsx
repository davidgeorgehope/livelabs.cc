"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ProgressiveHints } from "@/components/ProgressiveHints";
import { AIHelper } from "@/components/AIHelper";
import { CodeExplainer } from "@/components/CodeExplainer";
import { Step } from "@/lib/api";
import { ChevronRight, ChevronLeft, BookOpen, Lightbulb, Sparkles } from "lucide-react";

interface InstructionsSidebarProps {
  step: Step | undefined;
  stepNumber: number;
  totalSteps: number;
  lastError?: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function InstructionsSidebar({
  step,
  stepNumber,
  totalSteps,
  lastError,
  collapsed,
  onToggle,
}: InstructionsSidebarProps) {
  const [activeTab, setActiveTab] = useState<"instructions" | "hints">("instructions");

  if (collapsed) {
    return (
      <div className="w-12 border-l bg-muted/30 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-8 h-8 p-0 mb-4"
          title="Expand sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
            title="Instructions"
            onClick={onToggle}
          >
            <BookOpen className="h-4 w-4" />
          </Button>
          {step?.hints && step.hints.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
              title="Hints"
              onClick={() => {
                onToggle();
                setActiveTab("hints");
              }}
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[350px] border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
            Step {stepNumber}/{totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {step && (
            <>
              <AIHelper
                stepTitle={step.title}
                stepInstructions={step.instructions_md || ""}
                lastError={lastError}
              />
              <CodeExplainer context={step.title} />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-7 w-7 p-0"
            title="Collapse sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      {step?.hints && step.hints.length > 0 && (
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("instructions")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "instructions"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-1.5" />
            Instructions
          </button>
          <button
            onClick={() => setActiveTab("hints")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "hints"
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lightbulb className="h-4 w-4 inline mr-1.5" />
            Hints
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {step ? (
          <>
            {activeTab === "instructions" && (
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-3">{step.title}</h2>
                <MarkdownRenderer
                  content={step.instructions_md || "No instructions provided."}
                />
              </div>
            )}
            {activeTab === "hints" && step.hints && step.hints.length > 0 && (
              <div className="p-4">
                <ProgressiveHints hints={step.hints} />
              </div>
            )}
          </>
        ) : (
          <div className="p-4 text-muted-foreground text-center">
            Select a step to view instructions.
          </div>
        )}
      </div>

      {/* AI Help prompt */}
      {step && lastError && (
        <div className="p-3 border-t bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-medium">Having trouble?</span> Click the AI Help button above to get assistance with this step.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
