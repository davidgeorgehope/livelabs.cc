"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TerminalOutput } from "@/components/TerminalOutput";
import { InteractiveTerminal } from "@/components/InteractiveTerminal";
import {
  ChevronUp,
  ChevronDown,
  Terminal,
  Play,
  CheckCircle,
  Loader2,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface SetupStatus {
  status: "idle" | "running" | "success" | "failed";
  message?: string;
}

interface TerminalDrawerProps {
  enrollmentId: number;
  token: string;
  canRunSetup: boolean;
  canValidate: boolean;
  isRunning: boolean;
  lastResult: {
    stdout: string;
    stderr: string;
    exit_code?: number;
    advanced?: boolean;
  } | null;
  setupStatus: SetupStatus;
  onRunScript: (type: "setup" | "validation") => void;
  onAdvanced?: () => void;
}

export function TerminalDrawer({
  enrollmentId,
  token,
  canRunSetup,
  canValidate,
  isRunning,
  lastResult,
  setupStatus,
  onRunScript,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAdvanced,
}: TerminalDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [height, setHeight] = useState(300);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<"scripts" | "shell">("shell");
  const drawerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Auto-expand on script run or setup failure
  useEffect(() => {
    if (isRunning || setupStatus.status === "failed" || lastResult?.stderr) {
      setIsExpanded(true);
    }
  }, [isRunning, setupStatus.status, lastResult?.stderr]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newHeight = window.innerHeight - e.clientY;
      setHeight(Math.min(Math.max(newHeight, 150), window.innerHeight - 200));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (isFullscreen) setIsFullscreen(false);
  };

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1e1e1e] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
          <div className="flex items-center gap-4">
            <Terminal className="h-5 w-5 text-gray-400" />
            <span className="text-white font-medium">Terminal</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(false)}
            className="text-gray-400 hover:text-white"
          >
            <Minimize2 className="h-4 w-4 mr-1" />
            Exit Fullscreen
          </Button>
        </div>
        <div className="flex-1">
          <InteractiveTerminal enrollmentId={enrollmentId} token={token} />
        </div>
      </div>
    );
  }

  // Collapsed state - just the header bar
  if (!isExpanded) {
    return (
      <div className="border-t bg-[#252526]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleExpand}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronUp className="h-4 w-4" />
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-medium">Terminal</span>
            </button>

            {/* Setup status indicator */}
            {setupStatus.status !== "idle" && (
              <div className="flex items-center gap-1.5 text-xs">
                {setupStatus.status === "running" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                    <span className="text-blue-400">Setting up...</span>
                  </>
                )}
                {setupStatus.status === "success" && (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">Setup complete</span>
                  </>
                )}
                {setupStatus.status === "failed" && (
                  <>
                    <X className="h-3 w-3 text-red-400" />
                    <span className="text-red-400">Setup failed</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRunScript("setup")}
              disabled={isRunning || !canRunSetup}
              className="h-7 text-xs bg-transparent border-[#3c3c3c] text-gray-300 hover:text-white hover:bg-[#3c3c3c]"
            >
              <Play className="h-3 w-3 mr-1" />
              Setup
            </Button>
            <Button
              size="sm"
              onClick={() => onRunScript("validation")}
              disabled={isRunning || !canValidate}
              className="h-7 text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Validate
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      ref={drawerRef}
      className="border-t bg-[#1e1e1e] flex flex-col"
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-1 bg-[#252526] cursor-row-resize hover:bg-primary/50 transition-colors"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleExpand}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Terminal</span>
          </button>

          {/* Mode toggle */}
          <div className="flex items-center bg-[#1e1e1e] rounded-md p-0.5 ml-2">
            <Button
              size="sm"
              variant={mode === "shell" ? "secondary" : "ghost"}
              onClick={() => setMode("shell")}
              className="h-6 text-xs px-2"
            >
              Shell
            </Button>
            <Button
              size="sm"
              variant={mode === "scripts" ? "secondary" : "ghost"}
              onClick={() => setMode("scripts")}
              className="h-6 text-xs px-2"
            >
              Output
            </Button>
          </div>

          {/* Setup status */}
          {setupStatus.status !== "idle" && (
            <div className="flex items-center gap-1.5 text-xs ml-2">
              {setupStatus.status === "running" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                  <span className="text-blue-400">Setting up...</span>
                </>
              )}
              {setupStatus.status === "success" && (
                <>
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span className="text-green-400">Setup complete</span>
                </>
              )}
              {setupStatus.status === "failed" && (
                <>
                  <X className="h-3 w-3 text-red-400" />
                  <span className="text-red-400">Setup failed</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === "scripts" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunScript("setup")}
                disabled={isRunning || !canRunSetup}
                className="h-7 text-xs bg-transparent border-[#3c3c3c] text-gray-300 hover:text-white hover:bg-[#3c3c3c]"
              >
                <Play className="h-3 w-3 mr-1" />
                Setup
              </Button>
              <Button
                size="sm"
                onClick={() => onRunScript("validation")}
                disabled={isRunning || !canValidate}
                className="h-7 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Validate
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "shell" ? (
          <InteractiveTerminal enrollmentId={enrollmentId} token={token} />
        ) : (
          <div className="h-full overflow-auto p-4">
            <TerminalOutput
              stdout={lastResult?.stdout || ""}
              stderr={lastResult?.stderr || ""}
              exitCode={lastResult?.exit_code}
              isRunning={isRunning}
            />
          </div>
        )}
      </div>

      {/* Success message */}
      {lastResult?.advanced && (
        <div className="px-4 py-2 bg-green-600 text-white text-sm">
          Validation passed! Moving to next step...
        </div>
      )}
    </div>
  );
}
