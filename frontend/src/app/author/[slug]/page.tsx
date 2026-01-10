"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tracks, steps, Track, Step, TrackWithSteps, StepCreate, StepUpdate } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScriptEditor } from "@/components/ScriptEditor";
import { Plus, Save, Trash2, ArrowLeft, Eye, EyeOff } from "lucide-react";

export default function TrackEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [track, setTrack] = useState<TrackWithSteps | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step form state
  const [stepTitle, setStepTitle] = useState("");
  const [stepInstructions, setStepInstructions] = useState("");
  const [setupScript, setSetupScript] = useState("");
  const [validationScript, setValidationScript] = useState("");

  const slug = params.slug as string;

  const loadTrack = useCallback(async () => {
    if (!token) return;
    try {
      const data = await tracks.get(slug, token);
      setTrack(data);
      if (data.steps.length > 0 && !selectedStepId) {
        selectStep(data.steps[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load track");
    } finally {
      setIsLoading(false);
    }
  }, [slug, token, selectedStepId]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push("/login");
      return;
    }
    loadTrack();
  }, [token, authLoading, router, loadTrack]);

  const selectStep = (step: Step) => {
    setSelectedStepId(step.id);
    setStepTitle(step.title);
    setStepInstructions(step.instructions_md);
    setSetupScript(step.setup_script);
    setValidationScript(step.validation_script);
  };

  const handleAddStep = async () => {
    if (!token || !track) return;

    const newStep: StepCreate = {
      title: `Step ${track.steps.length + 1}`,
      instructions_md: "# New Step\n\nAdd your instructions here.",
      setup_script: "",
      validation_script: "",
    };

    try {
      const step = await steps.create(slug, newStep, token);
      await loadTrack();
      selectStep(step);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add step");
    }
  };

  const handleSaveStep = async () => {
    if (!token || !selectedStepId) return;

    setIsSaving(true);
    const update: StepUpdate = {
      title: stepTitle,
      instructions_md: stepInstructions,
      setup_script: setupScript,
      validation_script: validationScript,
    };

    try {
      await steps.update(slug, selectedStepId, update, token);
      await loadTrack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStep = async (stepId: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this step?")) return;

    try {
      await steps.delete(slug, stepId, token);
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
        setStepTitle("");
        setStepInstructions("");
        setSetupScript("");
        setValidationScript("");
      }
      await loadTrack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete step");
    }
  };

  const handleTogglePublish = async () => {
    if (!token || !track) return;

    try {
      await tracks.update(slug, { is_published: !track.is_published }, token);
      await loadTrack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update track");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-red-500">{error || "Track not found"}</div>
      </div>
    );
  }

  const selectedStep = track.steps.find((s) => s.id === selectedStepId);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/author")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="font-semibold">{track.title}</h1>
          <span
            className={`text-xs px-2 py-1 rounded ${
              track.is_published
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {track.is_published ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTogglePublish}>
            {track.is_published ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Step list sidebar */}
        <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Steps</h2>
            <Button variant="ghost" size="sm" onClick={handleAddStep}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {track.steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer ${
                  selectedStepId === step.id ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => selectStep(step)}
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                  {step.order}
                </span>
                <span className="flex-1 truncate text-sm">{step.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStep(step.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          {track.steps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No steps yet. Click + to add one.
            </p>
          )}
        </div>

        {/* Step editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedStep ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1 mr-4">
                  <Label htmlFor="stepTitle">Step Title</Label>
                  <Input
                    id="stepTitle"
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    placeholder="Step title"
                  />
                </div>
                <Button onClick={handleSaveStep} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? "Saving..." : "Save Step"}
                </Button>
              </div>

              <Tabs defaultValue="instructions">
                <TabsList>
                  <TabsTrigger value="instructions">Instructions</TabsTrigger>
                  <TabsTrigger value="setup">Setup Script</TabsTrigger>
                  <TabsTrigger value="validation">Validation Script</TabsTrigger>
                </TabsList>

                <TabsContent value="instructions" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Instructions (Markdown)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        value={stepInstructions}
                        onChange={(e) => setStepInstructions(e.target.value)}
                        className="w-full h-[400px] px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
                        placeholder="# Step Title\n\nWrite your instructions here..."
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="setup" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Setup Script (Bash)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScriptEditor
                        value={setupScript}
                        onChange={setSetupScript}
                        height="400px"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        This script runs when the learner clicks &quot;Run Setup&quot;.
                        Environment variables will be injected.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="validation" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Validation Script (Bash)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScriptEditor
                        value={validationScript}
                        onChange={setValidationScript}
                        height="400px"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        This script runs when the learner clicks &quot;Validate&quot;.
                        Exit code 0 = pass, non-zero = fail.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select a step to edit or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
