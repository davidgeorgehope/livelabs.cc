"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { enrollments, execution, EnrollmentDetail, ExecutionResult } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { StepList } from "@/components/StepList";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TerminalOutput } from "@/components/TerminalOutput";
import { ProgressiveHints } from "@/components/ProgressiveHints";
import { ResizablePane } from "@/components/ResizablePane";
import { AIHelper } from "@/components/AIHelper";
import { CodeExplainer } from "@/components/CodeExplainer";
import { InteractiveTerminal } from "@/components/InteractiveTerminal";
import { Play, CheckCircle, ChevronLeft, ChevronRight, Maximize2, Minimize2, X, Terminal } from "lucide-react";

export default function TrackPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [selectedStep, setSelectedStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalMode, setTerminalMode] = useState<"batch" | "interactive">("batch");

  const enrollmentId = parseInt(params.id as string);

  const loadEnrollment = useCallback(async () => {
    if (!token) return;
    try {
      const data = await enrollments.get(enrollmentId, token);
      setEnrollment(data);
      setSelectedStep(data.current_step);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollment");
    } finally {
      setIsLoading(false);
    }
  }, [enrollmentId, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    loadEnrollment();
  }, [token, authLoading, router, loadEnrollment]);

  const runScript = async (scriptType: "setup" | "validation") => {
    if (!token || !enrollment) return;

    setIsRunning(true);
    setLastResult(null);

    try {
      const result = await execution.run(enrollmentId, selectedStep, scriptType, token);
      setLastResult(result);

      if (result.advanced) {
        await loadEnrollment();
      }
    } catch (err) {
      setLastResult({
        success: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : "Execution failed",
        exit_code: 1,
        duration_ms: 0,
        advanced: false,
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !enrollment) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-red-500">{error || "Enrollment not found"}</div>
      </div>
    );
  }

  const currentStepData = enrollment.track.steps.find((s) => s.order === selectedStep);
  const isCompleted = enrollment.completed_at !== null;
  const canRunSetup = selectedStep <= enrollment.current_step && currentStepData?.setup_script;
  const canValidate = selectedStep <= enrollment.current_step && currentStepData?.validation_script;

  // Get last error from failed validation
  const lastError = lastResult && !lastResult.success && lastResult.stderr
    ? lastResult.stderr
    : null;

  // Instructions content
  const instructionsContent = (
    <div className="h-full overflow-y-auto p-6">
      {currentStepData ? (
        <>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold">{currentStepData.title}</h1>
            <div className="flex items-center gap-2">
              <AIHelper
                stepTitle={currentStepData.title}
                stepInstructions={currentStepData.instructions_md || ""}
                lastError={lastError}
              />
              <CodeExplainer context={currentStepData.title} />
              <span className="text-sm text-muted-foreground">
                Step {selectedStep} of {enrollment.track.steps.length}
              </span>
            </div>
          </div>

          <MarkdownRenderer content={currentStepData.instructions_md || "No instructions provided."} />

          {currentStepData.hints && currentStepData.hints.length > 0 && (
            <div className="mt-6">
              <ProgressiveHints hints={currentStepData.hints} />
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground">Select a step to view instructions.</div>
      )}
    </div>
  );

  // Terminal content
  const terminalContent = (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center bg-[#1e1e1e] rounded-md p-0.5">
            <Button
              size="sm"
              variant={terminalMode === "batch" ? "secondary" : "ghost"}
              onClick={() => setTerminalMode("batch")}
              className="h-6 text-xs px-2"
            >
              <Play className="h-3 w-3 mr-1" />
              Scripts
            </Button>
            <Button
              size="sm"
              variant={terminalMode === "interactive" ? "secondary" : "ghost"}
              onClick={() => setTerminalMode("interactive")}
              className="h-6 text-xs px-2"
            >
              <Terminal className="h-3 w-3 mr-1" />
              Shell
            </Button>
          </div>

          {terminalMode === "batch" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runScript("setup")}
                disabled={isRunning || !canRunSetup}
                className="h-7 text-xs"
              >
                <Play className="h-3 w-3 mr-1" />
                Setup
              </Button>
              <Button
                size="sm"
                onClick={() => runScript("validation")}
                disabled={isRunning || !canValidate}
                className="h-7 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Validate
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedStep(Math.max(1, selectedStep - 1))}
            disabled={selectedStep <= 1}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedStep(Math.min(enrollment.track.steps.length, selectedStep + 1))}
            disabled={selectedStep >= enrollment.current_step || selectedStep >= enrollment.track.steps.length}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Terminal output */}
      <div className="flex-1 overflow-auto">
        {terminalMode === "batch" ? (
          <div className="p-4">
            <TerminalOutput
              stdout={lastResult?.stdout || ""}
              stderr={lastResult?.stderr || ""}
              exitCode={lastResult?.exit_code}
              isRunning={isRunning}
            />
          </div>
        ) : (
          token && <InteractiveTerminal enrollmentId={enrollmentId} token={token} />
        )}
      </div>

      {/* Success message */}
      {terminalMode === "batch" && lastResult?.advanced && (
        <div className="px-4 py-2 bg-green-600 text-white text-sm">
          {enrollment.current_step < enrollment.track.steps.length
            ? "Validation passed! Moving to next step..."
            : "Congratulations! You've completed the track!"}
        </div>
      )}
    </div>
  );

  // Fullscreen terminal mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1e1e1e]">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
            <div className="flex items-center gap-4">
              <span className="text-white font-medium">{enrollment.track.title}</span>
              <span className="text-gray-400 text-sm">Step {selectedStep}: {currentStepData?.title}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Exit Fullscreen
            </Button>
          </div>
          <div className="flex-1">
            {terminalContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? "w-0" : "w-72"} transition-all duration-200 border-r bg-muted/30 overflow-hidden`}>
        <div className="w-72 h-full p-4 overflow-y-auto">
          <div className="mb-4">
            <h2 className="font-semibold">{enrollment.track.title}</h2>
            {isCompleted && (
              <span className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle className="h-4 w-4" /> Completed
              </span>
            )}
          </div>
          <StepList
            steps={enrollment.track.steps}
            currentStep={enrollment.current_step}
            selectedStep={selectedStep}
            onSelectStep={setSelectedStep}
            estimatedMinutes={enrollment.track.estimated_minutes}
          />
        </div>
      </div>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-muted border rounded-r-md p-1 hover:bg-accent"
        style={{ marginLeft: sidebarCollapsed ? 0 : "18rem" }}
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Main content with resizable panes */}
      <div className="flex-1 overflow-hidden">
        <ResizablePane
          topContent={instructionsContent}
          bottomContent={terminalContent}
          defaultTopHeight={60}
          minTopHeight={30}
          maxTopHeight={80}
        />
      </div>
    </div>
  );
}
