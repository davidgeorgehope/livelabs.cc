"use client";

import { useState } from "react";
import { ai } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Wand2, Loader2, FileText, Code, Lightbulb, Check, Copy, Play } from "lucide-react";

type AssistantMode = "instructions" | "setup" | "validation" | "hints";

interface AITrackAssistantProps {
  stepTitle: string;
  currentInstructions?: string;
  currentSetupScript?: string;
  currentValidationScript?: string;
  onApplyInstructions?: (instructions: string) => void;
  onApplySetup?: (script: string) => void;
  onApplyValidation?: (script: string, hints: string[]) => void;
  onApplyHints?: (hints: string[]) => void;
}

export function AITrackAssistant({
  stepTitle,
  currentInstructions,
  currentSetupScript,
  currentValidationScript,
  onApplyInstructions,
  onApplySetup,
  onApplyValidation,
  onApplyHints,
}: AITrackAssistantProps) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("instructions");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instructions mode state
  const [bulletPoints, setBulletPoints] = useState("");
  const [trackContext, setTrackContext] = useState("");
  const [generatedInstructions, setGeneratedInstructions] = useState("");

  // Setup mode state
  const [setupExpectedState, setSetupExpectedState] = useState("");
  const [setupContext, setSetupContext] = useState("");
  const [generatedSetup, setGeneratedSetup] = useState("");
  const [setupNotes, setSetupNotes] = useState<string[]>([]);

  // Validation mode state
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [generatedValidation, setGeneratedValidation] = useState("");
  const [generatedHints, setGeneratedHints] = useState<string[]>([]);

  // Hints mode state
  const [hintsFromValidation, setHintsFromValidation] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);

  const handleGenerateInstructions = async () => {
    if (!token || !bulletPoints.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const points = bulletPoints
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p);

      const response = await ai.generateInstructions(
        {
          title: stepTitle,
          bullet_points: points,
          track_context: trackContext || undefined,
        },
        token
      );

      setGeneratedInstructions(response.instructions_md);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate instructions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSetup = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await ai.generateSetup(
        {
          step_title: stepTitle,
          step_instructions: currentInstructions || "",
          expected_state: setupExpectedState || undefined,
          additional_context: setupContext || undefined,
        },
        token
      );

      setGeneratedSetup(response.setup_script);
      setSetupNotes(response.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate setup script");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateValidation = async () => {
    if (!token || !expectedOutcome.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await ai.generateValidation(
        {
          step_title: stepTitle,
          expected_outcome: expectedOutcome,
          setup_script: currentSetupScript || undefined,
        },
        token
      );

      setGeneratedValidation(response.validation_script);
      setGeneratedHints(response.hints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate validation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateHints = async () => {
    if (!token || !currentValidationScript?.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await ai.generateHints(
        {
          step_title: stepTitle,
          instructions: currentInstructions || "",
          validation_script: currentValidationScript,
        },
        token
      );

      setHintsFromValidation(response.hints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate hints");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyInstructions = () => {
    if (onApplyInstructions && generatedInstructions) {
      onApplyInstructions(generatedInstructions);
      setIsOpen(false);
      resetState();
    }
  };

  const handleApplySetup = () => {
    if (onApplySetup && generatedSetup) {
      onApplySetup(generatedSetup);
      setIsOpen(false);
      resetState();
    }
  };

  const handleApplyValidation = () => {
    if (onApplyValidation && generatedValidation) {
      onApplyValidation(generatedValidation, generatedHints);
      setIsOpen(false);
      resetState();
    }
  };

  const handleApplyHints = () => {
    if (onApplyHints && hintsFromValidation.length > 0) {
      onApplyHints(hintsFromValidation);
      setIsOpen(false);
      resetState();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetState = () => {
    setBulletPoints("");
    setTrackContext("");
    setGeneratedInstructions("");
    setSetupExpectedState("");
    setSetupContext("");
    setGeneratedSetup("");
    setSetupNotes([]);
    setExpectedOutcome("");
    setGeneratedValidation("");
    setGeneratedHints([]);
    setHintsFromValidation([]);
    setError(null);
  };

  const getModeIcon = (m: AssistantMode) => {
    switch (m) {
      case "instructions":
        return <FileText className="h-4 w-4" />;
      case "setup":
        return <Play className="h-4 w-4" />;
      case "validation":
        return <Code className="h-4 w-4" />;
      case "hints":
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getModeLabel = (m: AssistantMode) => {
    switch (m) {
      case "instructions":
        return "Instructions";
      case "setup":
        return "Setup";
      case "validation":
        return "Validation";
      case "hints":
        return "Hints";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="h-4 w-4" />
          AI Assistant
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[640px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            AI Track Assistant
          </SheetTitle>
          <SheetDescription>
            Generate content for step: {stepTitle}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col mt-4 overflow-hidden">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-muted rounded-lg">
            {(["instructions", "setup", "validation", "hints"] as AssistantMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  mode === m
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/50"
                }`}
              >
                {getModeIcon(m)}
                {getModeLabel(m)}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {mode === "instructions" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bulletPoints">Key points to cover</Label>
                  <Textarea
                    id="bulletPoints"
                    value={bulletPoints}
                    onChange={(e) => setBulletPoints(e.target.value)}
                    placeholder="Enter each point on a new line:&#10;Create a new file&#10;Add the configuration&#10;Run the test command"
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    One point per line. The AI will expand these into full instructions.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackContext">Track context (optional)</Label>
                  <Input
                    id="trackContext"
                    value={trackContext}
                    onChange={(e) => setTrackContext(e.target.value)}
                    placeholder="e.g., Kubernetes basics, Python web development"
                  />
                </div>

                <Button
                  onClick={handleGenerateInstructions}
                  disabled={isLoading || !bulletPoints.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Instructions
                    </>
                  )}
                </Button>

                {generatedInstructions && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label>Generated Instructions</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(generatedInstructions)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                      {generatedInstructions}
                    </pre>
                    <Button onClick={handleApplyInstructions} className="w-full">
                      Apply to Step
                    </Button>
                  </div>
                )}
              </>
            )}

            {mode === "setup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="setupExpectedState">Expected state after setup</Label>
                  <Textarea
                    id="setupExpectedState"
                    value={setupExpectedState}
                    onChange={(e) => setSetupExpectedState(e.target.value)}
                    placeholder="Describe what should exist after setup runs:&#10;A config file in /etc/myapp/&#10;Required packages installed&#10;Database initialized"
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    What environment should be ready for the learner?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setupContext">Additional context (optional)</Label>
                  <Input
                    id="setupContext"
                    value={setupContext}
                    onChange={(e) => setSetupContext(e.target.value)}
                    placeholder="e.g., Uses Docker, Python 3.11, PostgreSQL"
                  />
                </div>

                <Button
                  onClick={handleGenerateSetup}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Setup Script
                    </>
                  )}
                </Button>

                {generatedSetup && (
                  <div className="space-y-4">
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label>Generated Script</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(generatedSetup)}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <pre className="text-xs bg-background p-3 rounded overflow-x-auto max-h-[150px] overflow-y-auto font-mono">
                        {generatedSetup}
                      </pre>
                    </div>

                    {setupNotes.length > 0 && (
                      <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <Label>Notes</Label>
                        <ul className="text-sm space-y-1">
                          {setupNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button onClick={handleApplySetup} className="w-full">
                      Apply to Step
                    </Button>
                  </div>
                )}
              </>
            )}

            {mode === "validation" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="expectedOutcome">Expected outcome</Label>
                  <Textarea
                    id="expectedOutcome"
                    value={expectedOutcome}
                    onChange={(e) => setExpectedOutcome(e.target.value)}
                    placeholder="Describe what the learner should have accomplished:&#10;A file named config.yaml exists with the correct structure&#10;The service is running on port 8080"
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe what should be true when the step is completed correctly.
                  </p>
                </div>

                <Button
                  onClick={handleGenerateValidation}
                  disabled={isLoading || !expectedOutcome.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Validation Script
                    </>
                  )}
                </Button>

                {generatedValidation && (
                  <div className="space-y-4">
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label>Generated Script</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(generatedValidation)}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <pre className="text-xs bg-background p-3 rounded overflow-x-auto max-h-[150px] overflow-y-auto font-mono">
                        {generatedValidation}
                      </pre>
                    </div>

                    {generatedHints.length > 0 && (
                      <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <Label>Suggested Hints</Label>
                        <ul className="text-sm space-y-1">
                          {generatedHints.map((hint, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-muted-foreground">{i + 1}.</span>
                              {hint}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button onClick={handleApplyValidation} className="w-full">
                      Apply Script & Hints
                    </Button>
                  </div>
                )}
              </>
            )}

            {mode === "hints" && (
              <>
                <div className="space-y-2">
                  <Label>Current Validation Script</Label>
                  {currentValidationScript ? (
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[100px] overflow-y-auto font-mono">
                      {currentValidationScript}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No validation script set. Add one first to generate hints.
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleGenerateHints}
                  disabled={isLoading || !currentValidationScript?.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Progressive Hints
                    </>
                  )}
                </Button>

                {hintsFromValidation.length > 0 && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <Label>Generated Hints (from least to most revealing)</Label>
                    <ol className="text-sm space-y-2 list-decimal list-inside">
                      {hintsFromValidation.map((hint, i) => (
                        <li key={i}>{hint}</li>
                      ))}
                    </ol>
                    <Button onClick={handleApplyHints} className="w-full mt-3">
                      Apply Hints to Step
                    </Button>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
