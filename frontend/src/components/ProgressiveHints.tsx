"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressiveHintsProps {
  hints: string[];
}

export function ProgressiveHints({ hints }: ProgressiveHintsProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hints || hints.length === 0) {
    return null;
  }

  const revealNextHint = () => {
    if (revealedCount < hints.length) {
      setRevealedCount(revealedCount + 1);
      setIsExpanded(true);
    }
  };

  const hasMoreHints = revealedCount < hints.length;
  const hasRevealedHints = revealedCount > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
          hasRevealedHints ? "bg-amber-50 hover:bg-amber-100" : "bg-muted/50 hover:bg-muted"
        )}
        onClick={() => hasRevealedHints && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className={cn(
            "h-5 w-5",
            hasRevealedHints ? "text-amber-600" : "text-muted-foreground"
          )} />
          <span className="font-medium">
            {hasRevealedHints
              ? `${revealedCount} hint${revealedCount > 1 ? "s" : ""} revealed`
              : "Need a hint?"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasMoreHints && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                revealNextHint();
              }}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-100"
            >
              <Eye className="h-4 w-4 mr-1" />
              {hasRevealedHints ? "Next hint" : "Show hint"}
              <span className="ml-1 text-xs text-muted-foreground">
                ({hints.length - revealedCount} left)
              </span>
            </Button>
          )}
          {hasRevealedHints && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </div>
      </div>

      {/* Hints content */}
      {hasRevealedHints && isExpanded && (
        <div className="px-4 py-3 space-y-3 bg-white border-t">
          {hints.slice(0, revealedCount).map((hint, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 p-3 rounded-md",
                index === revealedCount - 1 ? "bg-amber-50 border border-amber-200" : "bg-muted/30"
              )}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </span>
              <p className="text-sm text-gray-700">{hint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
