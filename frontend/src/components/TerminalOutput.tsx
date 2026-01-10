"use client";

import { cn } from "@/lib/utils";

interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  exitCode?: number;
  isRunning?: boolean;
  className?: string;
}

export function TerminalOutput({
  stdout,
  stderr,
  exitCode,
  isRunning,
  className,
}: TerminalOutputProps) {
  const hasOutput = stdout || stderr;

  return (
    <div
      className={cn(
        "bg-neutral-900 text-neutral-100 rounded-md p-4 terminal-output min-h-[200px] max-h-[400px] overflow-auto",
        className
      )}
    >
      {isRunning && (
        <div className="flex items-center gap-2 mb-2 text-yellow-400">
          <span className="animate-pulse">Running...</span>
        </div>
      )}

      {!hasOutput && !isRunning && (
        <div className="text-neutral-500">No output yet. Run a script to see results.</div>
      )}

      {stdout && (
        <pre className="whitespace-pre-wrap text-green-400">{stdout}</pre>
      )}

      {stderr && (
        <pre className="whitespace-pre-wrap text-red-400 mt-2">{stderr}</pre>
      )}

      {exitCode !== undefined && !isRunning && (
        <div
          className={cn(
            "mt-4 pt-2 border-t border-neutral-700 text-sm",
            exitCode === 0 ? "text-green-400" : "text-red-400"
          )}
        >
          Exit code: {exitCode}
        </div>
      )}
    </div>
  );
}
