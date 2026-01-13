"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  enrollments,
  execution,
  EnrollmentDetail,
  ExecutionResult,
  AppContainerStatus,
} from "@/lib/api";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ProgressiveHints } from "@/components/ProgressiveHints";
import { AIHelper } from "@/components/AIHelper";
import { CodeExplainer } from "@/components/CodeExplainer";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { StepList } from "@/components/StepList";
import { AppWindow } from "@/components/AppWindow";
import { InstructionsSidebar } from "@/components/InstructionsSidebar";
import { TerminalDrawer } from "@/components/TerminalDrawer";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Menu,
  X,
  Loader2,
} from "lucide-react";

type SetupStatus = {
  status: "idle" | "running" | "success" | "failed";
  message?: string;
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stepListOpen, setStepListOpen] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({ status: "idle" });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [appStatus, setAppStatus] = useState<AppContainerStatus | null>(null);
  const autoSetupRan = useRef<Set<number>>(new Set());

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

  // Auto-run setup script when entering a step
  useEffect(() => {
    const runAutoSetup = async () => {
      if (!token || !enrollment) return;
      if (autoSetupRan.current.has(selectedStep)) return;

      const track = enrollment.track;
      const step = track.steps.find((s) => s.order === selectedStep);

      if (!step?.setup_script || !track.auto_run_setup) return;
      if (selectedStep > enrollment.current_step) return;

      autoSetupRan.current.add(selectedStep);
      setSetupStatus({ status: "running" });

      try {
        const result = await execution.autoSetup(enrollmentId, selectedStep, token);
        if (result.skipped) {
          setSetupStatus({ status: "success", message: result.reason });
        } else if (result.success) {
          setSetupStatus({ status: "success" });
        } else {
          setSetupStatus({ status: "failed", message: result.stderr });
          setLastResult({
            success: false,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            exit_code: result.exit_code || 1,
            duration_ms: result.duration_ms || 0,
            advanced: false,
          });
        }
      } catch (err) {
        setSetupStatus({
          status: "failed",
          message: err instanceof Error ? err.message : "Setup failed",
        });
      }
    };

    runAutoSetup();
  }, [selectedStep, enrollment, enrollmentId, token]);

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

  const handleStepChange = (step: number) => {
    setSelectedStep(step);
    setLastResult(null);
    setSetupStatus({ status: "idle" });
    setStepListOpen(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading lab...</span>
        </div>
      </div>
    );
  }

  if (error || !enrollment) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || "Enrollment not found"}</div>
          <Button variant="outline" onClick={() => router.push("/learn")}>
            Back to Learning
          </Button>
        </div>
      </div>
    );
  }

  const currentStepData = enrollment.track.steps.find((s) => s.order === selectedStep);
  const isCompleted = enrollment.completed_at !== null;
  const canRunSetup = selectedStep <= enrollment.current_step && !!currentStepData?.setup_script;
  const canValidate = selectedStep <= enrollment.current_step && !!currentStepData?.validation_script;
  const hasApp = enrollment.track.app_url_template || enrollment.track.app_container_image || enrollment.track.init_script;

  const lastError =
    lastResult && !lastResult.success && lastResult.stderr ? lastResult.stderr : null;

  // Progress percentage
  const progress = Math.round(
    ((enrollment.current_step - 1) / enrollment.track.steps.length) * 100
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Step list toggle (mobile) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStepListOpen(!stepListOpen)}
            className="lg:hidden h-8 w-8 p-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm lg:text-base truncate max-w-[200px] lg:max-w-none">
              {enrollment.track.title}
            </h1>
            {isCompleted && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span className="hidden sm:inline">Completed</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {enrollment.current_step}/{enrollment.track.steps.length}
            </span>
          </div>

          {/* Step navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStepChange(Math.max(1, selectedStep - 1))}
              disabled={selectedStep <= 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              Step {selectedStep}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                handleStepChange(
                  Math.min(enrollment.track.steps.length, selectedStep + 1)
                )
              }
              disabled={
                selectedStep >= enrollment.current_step ||
                selectedStep >= enrollment.track.steps.length
              }
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Step list sidebar (desktop) */}
        <div className="hidden lg:block w-56 border-r bg-muted/20 overflow-y-auto">
          <div className="p-3">
            <StepList
              steps={enrollment.track.steps}
              currentStep={enrollment.current_step}
              selectedStep={selectedStep}
              onSelectStep={handleStepChange}
              estimatedMinutes={enrollment.track.estimated_minutes}
            />
          </div>
        </div>

        {/* Mobile step list overlay */}
        {stepListOpen && (
          <div className="absolute inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setStepListOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b">
                <span className="font-medium">Steps</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStepListOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-3">
                <StepList
                  steps={enrollment.track.steps}
                  currentStep={enrollment.current_step}
                  selectedStep={selectedStep}
                  onSelectStep={handleStepChange}
                  estimatedMinutes={enrollment.track.estimated_minutes}
                />
              </div>
            </div>
          </div>
        )}

        {/* App window */}
        <div className="flex-1 overflow-hidden">
          {hasApp ? (
            <AppWindow
              enrollmentId={enrollmentId}
              token={token!}
              onStatusChange={setAppStatus}
            />
          ) : (
            // No app - show instructions prominently
            <div className="h-full overflow-y-auto p-6 lg:p-8">
              {currentStepData ? (
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                        Step {selectedStep}/{enrollment.track.steps.length}
                      </span>
                      <h1 className="text-2xl font-bold mt-2">{currentStepData.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                      <AIHelper
                        stepTitle={currentStepData.title}
                        stepInstructions={currentStepData.instructions_md || ""}
                        lastError={lastError}
                      />
                      <CodeExplainer context={currentStepData.title} />
                    </div>
                  </div>
                  <MarkdownRenderer
                    content={currentStepData.instructions_md || "No instructions provided."}
                  />
                  {currentStepData.hints && currentStepData.hints.length > 0 && (
                    <div className="mt-8">
                      <ProgressiveHints hints={currentStepData.hints} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-center">
                  Select a step to view instructions.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions sidebar (only when app is present) */}
        {hasApp && (
          <InstructionsSidebar
            step={currentStepData}
            stepNumber={selectedStep}
            totalSteps={enrollment.track.steps.length}
            lastError={lastError}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
      </div>

      {/* Terminal drawer */}
      <TerminalDrawer
        enrollmentId={enrollmentId}
        token={token!}
        canRunSetup={canRunSetup}
        canValidate={canValidate}
        isRunning={isRunning}
        lastResult={lastResult}
        setupStatus={setupStatus}
        onRunScript={runScript}
        onAdvanced={loadEnrollment}
      />
    </div>
  );
}
