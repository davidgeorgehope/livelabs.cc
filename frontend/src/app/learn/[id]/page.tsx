"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { enrollments, execution, EnrollmentDetail, ExecutionResult } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { StepList } from "@/components/StepList";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TerminalOutput } from "@/components/TerminalOutput";
import { Play, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";

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

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Sidebar */}
      <div className="w-72 border-r bg-muted/30 p-4 overflow-y-auto">
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
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Instructions */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStepData ? (
            <>
              <h1 className="text-2xl font-bold mb-4">{currentStepData.title}</h1>
              <MarkdownRenderer content={currentStepData.instructions_md || "No instructions provided."} />

              {currentStepData.hints && currentStepData.hints.length > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-md">
                  <h3 className="font-medium mb-2">Hints</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {currentStepData.hints.map((hint, i) => (
                      <li key={i}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted-foreground">Select a step to view instructions.</div>
          )}
        </div>

        {/* Terminal output */}
        <div className="border-t">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runScript("setup")}
                disabled={isRunning || !canRunSetup}
              >
                <Play className="h-4 w-4 mr-1" />
                Run Setup
              </Button>
              <Button
                size="sm"
                onClick={() => runScript("validation")}
                disabled={isRunning || !canValidate}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Validate
              </Button>

              <div className="flex-1" />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStep(Math.max(1, selectedStep - 1))}
                disabled={selectedStep <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Step {selectedStep} of {enrollment.track.steps.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedStep(Math.min(enrollment.track.steps.length, selectedStep + 1))}
                disabled={selectedStep >= enrollment.current_step || selectedStep >= enrollment.track.steps.length}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <TerminalOutput
              stdout={lastResult?.stdout || ""}
              stderr={lastResult?.stderr || ""}
              exitCode={lastResult?.exit_code}
              isRunning={isRunning}
            />

            {lastResult?.advanced && (
              <div className="mt-3 p-3 bg-green-100 text-green-800 rounded-md text-sm">
                Validation passed! {enrollment.current_step < enrollment.track.steps.length
                  ? "Moving to next step..."
                  : "You've completed the track!"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
