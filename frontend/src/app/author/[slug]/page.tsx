"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { tracks, steps, ai, Step, TrackWithStepsAndSecrets, StepCreate, StepUpdate, TrackUpdate } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepIDE } from "@/components/StepIDE";
import { GitSync } from "@/components/GitSync";
import { Plus, Save, Trash2, ArrowLeft, Eye, EyeOff, Settings, Sparkles, Loader2 } from "lucide-react";

// Init script example templates
const INIT_SCRIPT_TEMPLATES: Record<string, { name: string; script: string }> = {
  saas_sandbox: {
    name: "SaaS Sandbox Provisioning",
    script: `#!/bin/bash
# Provision a sandbox environment via API
# Uses: $API_KEY environment secret

RESPONSE=$(curl -s -X POST "https://api.example.com/sandboxes" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"template": "default"}')

URL=$(echo "$RESPONSE" | jq -r '.url')
TOKEN=$(echo "$RESPONSE" | jq -r '.session_token')

if [ -z "$URL" ] || [ "$URL" = "null" ]; then
  echo "Error: Failed to provision sandbox" >&2
  exit 1
fi

echo "{\\"url\\": \\"$URL\\", \\"cookies\\": [{\\"name\\": \\"session\\", \\"value\\": \\"$TOKEN\\"}]}"`,
  },
  static_token: {
    name: "Static URL with Generated Token",
    script: `#!/bin/bash
# Generate a unique session for static URL
SESSION_ID=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
URL="https://app.example.com/lab?session=$SESSION_ID"

echo "{\\"url\\": \\"$URL\\", \\"cookies\\": []}"`,
  },
  health_check: {
    name: "Docker Container Health Check",
    script: `#!/bin/bash
# Wait for Docker app to be ready, then return URL
MAX_RETRIES=30
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
  if curl -s -f "http://localhost:8080/health" > /dev/null 2>&1; then
    echo '{"url": "http://localhost:8080", "cookies": []}'
    exit 0
  fi
  sleep $RETRY_DELAY
done

echo "Error: App failed to start" >&2
exit 1`,
  },
  simple_url: {
    name: "Simple External URL",
    script: `#!/bin/bash
# Simple external URL - no provisioning needed
echo '{"url": "https://demo.example.com", "cookies": []}'`,
  },
};

export default function TrackEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [track, setTrack] = useState<TrackWithStepsAndSecrets | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step form state
  const [stepTitle, setStepTitle] = useState("");
  const [stepInstructions, setStepInstructions] = useState("");
  const [setupScript, setSetupScript] = useState("");
  const [validationScript, setValidationScript] = useState("");
  const [stepHints, setStepHints] = useState<string[]>([]);

  // Track settings state
  const [showSettings, setShowSettings] = useState(false);
  const [trackTags, setTrackTags] = useState("");
  const [trackDifficulty, setTrackDifficulty] = useState("beginner");
  const [trackEstimatedMinutes, setTrackEstimatedMinutes] = useState("");
  const [trackDescription, setTrackDescription] = useState("");
  const [envSecrets, setEnvSecrets] = useState<{ name: string; value: string }[]>([]);

  // App configuration state
  const [appUrlTemplate, setAppUrlTemplate] = useState("");
  const [appContainerImage, setAppContainerImage] = useState("");
  const [appContainerPorts, setAppContainerPorts] = useState<{ container: string; host: string }[]>([]);
  const [appContainerCommand, setAppContainerCommand] = useState("");
  const [appContainerLifecycle, setAppContainerLifecycle] = useState<"enrollment" | "step">("enrollment");
  const [autoRunSetup, setAutoRunSetup] = useState(true);
  const [autoLoginType, setAutoLoginType] = useState<"none" | "url_params" | "cookies">("none");
  const [autoLoginParams, setAutoLoginParams] = useState<{ name: string; value: string }[]>([]);
  const [initScript, setInitScript] = useState("");
  const [isGeneratingInit, setIsGeneratingInit] = useState(false);
  const [initAiContext, setInitAiContext] = useState("");
  const [initAiNotes, setInitAiNotes] = useState<string[]>([]);

  const slug = params.slug as string;

  const loadTrack = useCallback(async () => {
    if (!token) return;
    try {
      const data = await tracks.getForEditing(slug, token);
      setTrack(data);
      // Initialize track settings
      setTrackTags(data.tags?.join(", ") || "");
      setTrackDifficulty(data.difficulty || "beginner");
      setTrackEstimatedMinutes(data.estimated_minutes?.toString() || "");
      setTrackDescription(data.description || "");
      // Initialize env secrets
      const secrets = Object.entries(data.env_secrets || {}).map(([name, value]) => ({
        name,
        value,
      }));
      setEnvSecrets(secrets.length > 0 ? secrets : [{ name: "", value: "" }]);
      // Initialize app configuration
      setAppUrlTemplate(data.app_url_template || "");
      setAppContainerImage(data.app_container_image || "");
      const ports = (data.app_container_ports || []).map((p: { container: number; host: number | null }) => ({
        container: p.container.toString(),
        host: p.host?.toString() || "",
      }));
      setAppContainerPorts(ports.length > 0 ? ports : []);
      setAppContainerCommand(data.app_container_command || "");
      setAppContainerLifecycle(data.app_container_lifecycle || "enrollment");
      setAutoRunSetup(data.auto_run_setup !== false);
      setAutoLoginType(data.auto_login_type || "none");
      const loginParams = Object.entries(data.auto_login_config?.params || {}).map(([name, value]) => ({
        name,
        value: value as string,
      }));
      setAutoLoginParams(loginParams.length > 0 ? loginParams : []);
      setInitScript(data.init_script || "");
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
    setStepHints(step.hints || []);
    setHasUnsavedChanges(false);
  };

  // Wrappers to track unsaved changes
  const handleInstructionsChange = (value: string) => {
    setStepInstructions(value);
    setHasUnsavedChanges(true);
  };

  const handleSetupScriptChange = (value: string) => {
    setSetupScript(value);
    setHasUnsavedChanges(true);
  };

  const handleValidationScriptChange = (value: string) => {
    setValidationScript(value);
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (value: string) => {
    setStepTitle(value);
    setHasUnsavedChanges(true);
  };

  const handleHintsChange = (hints: string[]) => {
    setStepHints(hints);
    setHasUnsavedChanges(true);
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
      hints: stepHints,
    };

    try {
      await steps.update(slug, selectedStepId, update, token);
      setHasUnsavedChanges(false);
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
        setStepHints([]);
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

  const handleSaveTrackSettings = async () => {
    if (!token || !track) return;

    setIsSaving(true);
    // Convert env secrets array to object
    const secretsObj: Record<string, string> = {};
    envSecrets.forEach(({ name, value }) => {
      if (name.trim()) {
        secretsObj[name.trim()] = value;
      }
    });

    // Convert app container ports
    const ports = appContainerPorts
      .filter(p => p.container)
      .map(p => ({
        container: parseInt(p.container),
        host: p.host ? parseInt(p.host) : null,
      }));

    // Convert auto-login params
    const loginParams: Record<string, string> = {};
    autoLoginParams.forEach(({ name, value }) => {
      if (name.trim()) {
        loginParams[name.trim()] = value;
      }
    });

    const update: TrackUpdate = {
      description: trackDescription,
      tags: trackTags.split(",").map(t => t.trim()).filter(t => t),
      difficulty: trackDifficulty,
      estimated_minutes: trackEstimatedMinutes ? parseInt(trackEstimatedMinutes) : undefined,
      env_secrets: secretsObj,
      // App configuration
      app_url_template: appUrlTemplate || null,
      app_container_image: appContainerImage || null,
      app_container_ports: ports.length > 0 ? ports : [],
      app_container_command: appContainerCommand || null,
      app_container_lifecycle: appContainerLifecycle,
      auto_run_setup: autoRunSetup,
      auto_login_type: autoLoginType,
      auto_login_config: autoLoginType === "url_params" && Object.keys(loginParams).length > 0
        ? { params: loginParams }
        : {},
      init_script: initScript || null,
    };

    try {
      await tracks.update(slug, update, token);
      await loadTrack();
      setShowSettings(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update track");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSecret = () => {
    setEnvSecrets([...envSecrets, { name: "", value: "" }]);
  };

  const handleRemoveSecret = (index: number) => {
    setEnvSecrets(envSecrets.filter((_, i) => i !== index));
  };

  const handleSecretChange = (index: number, field: "name" | "value", value: string) => {
    const updated = [...envSecrets];
    updated[index][field] = value;
    setEnvSecrets(updated);
  };

  const handleGenerateInitScript = async () => {
    if (!token || !track) return;

    setIsGeneratingInit(true);
    setInitAiNotes([]);
    try {
      const secretNames = envSecrets
        .filter(s => s.name.trim())
        .map(s => s.name.trim());

      const result = await ai.generateInitScript({
        track_title: track.title,
        track_description: trackDescription || undefined,
        app_type: appContainerImage ? "docker_app" : appUrlTemplate ? "external_url" : "saas_sandbox",
        env_secret_names: secretNames.length > 0 ? secretNames : undefined,
        example_url: appUrlTemplate || undefined,
        additional_context: initAiContext || undefined,
      }, token);

      setInitScript(result.init_script);
      setInitAiNotes(result.notes);
    } catch (err) {
      console.error("Failed to generate init script:", err);
    } finally {
      setIsGeneratingInit(false);
    }
  };

  const handleLoadTemplate = (templateKey: string) => {
    const template = INIT_SCRIPT_TEMPLATES[templateKey];
    if (template) {
      setInitScript(template.script);
      setInitAiNotes([]);
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
          <GitSync trackSlug={slug} />
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
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

      {/* Track Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setShowSettings(false)}
          />
          <div className="w-96 bg-background border-l p-6 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Track Settings</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trackDescription">Description</Label>
                <textarea
                  id="trackDescription"
                  value={trackDescription}
                  onChange={(e) => setTrackDescription(e.target.value)}
                  className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                  placeholder="Track description..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trackTags">Tags (comma-separated)</Label>
                <Input
                  id="trackTags"
                  value={trackTags}
                  onChange={(e) => setTrackTags(e.target.value)}
                  placeholder="kubernetes, docker, devops"
                />
                <p className="text-xs text-muted-foreground">
                  Enter tags separated by commas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trackDifficulty">Difficulty</Label>
                <select
                  id="trackDifficulty"
                  value={trackDifficulty}
                  onChange={(e) => setTrackDifficulty(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trackEstimatedMinutes">Estimated Time (minutes)</Label>
                <Input
                  id="trackEstimatedMinutes"
                  type="number"
                  min="1"
                  value={trackEstimatedMinutes}
                  onChange={(e) => setTrackEstimatedMinutes(e.target.value)}
                  placeholder="30"
                />
              </div>

              {/* Environment Secrets */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label>Environment Secrets</Label>
                  <Button variant="ghost" size="sm" onClick={handleAddSecret}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  These variables will be available to your scripts at runtime
                </p>
                <div className="space-y-2">
                  {envSecrets.map((secret, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="VAR_NAME"
                        value={secret.name}
                        onChange={(e) => handleSecretChange(index, "name", e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                      <Input
                        placeholder="value"
                        type="password"
                        value={secret.value}
                        onChange={(e) => handleSecretChange(index, "value", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSecret(index)}
                        disabled={envSecrets.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* App Configuration */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">App Window Configuration</h3>
                <p className="text-xs text-muted-foreground">
                  Configure an application to display alongside the instructions
                </p>

                <div className="space-y-2">
                  <Label htmlFor="appUrlTemplate">App URL Template</Label>
                  <Input
                    id="appUrlTemplate"
                    value={appUrlTemplate}
                    onChange={(e) => setAppUrlTemplate(e.target.value)}
                    placeholder="https://app.example.com or http://localhost:{port}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{port}"} for Docker container ports
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appContainerImage">Docker Container Image</Label>
                  <Input
                    id="appContainerImage"
                    value={appContainerImage}
                    onChange={(e) => setAppContainerImage(e.target.value)}
                    placeholder="nginx:latest or your-app:v1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Run a Docker container as the app
                  </p>
                </div>

                {appContainerImage && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Port Mappings</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAppContainerPorts([...appContainerPorts, { container: "", host: "" }])}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {appContainerPorts.map((port, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Container port"
                            value={port.container}
                            onChange={(e) => {
                              const updated = [...appContainerPorts];
                              updated[index].container = e.target.value;
                              setAppContainerPorts(updated);
                            }}
                            className="flex-1"
                          />
                          <span className="text-muted-foreground">:</span>
                          <Input
                            placeholder="Host (auto)"
                            value={port.host}
                            onChange={(e) => {
                              const updated = [...appContainerPorts];
                              updated[index].host = e.target.value;
                              setAppContainerPorts(updated);
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAppContainerPorts(appContainerPorts.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appContainerCommand">Command Override</Label>
                      <Input
                        id="appContainerCommand"
                        value={appContainerCommand}
                        onChange={(e) => setAppContainerCommand(e.target.value)}
                        placeholder="Optional: custom command"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appContainerLifecycle">Container Lifecycle</Label>
                      <select
                        id="appContainerLifecycle"
                        value={appContainerLifecycle}
                        onChange={(e) => setAppContainerLifecycle(e.target.value as "enrollment" | "step")}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="enrollment">Per-enrollment (runs for entire track)</option>
                        <option value="step">Per-step (restarts each step)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Initialization Script */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="initScript">Initialization Script</Label>
                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleLoadTemplate(e.target.value);
                          e.target.value = "";
                        }}
                        className="h-8 px-2 text-xs rounded-md border border-input bg-background"
                        defaultValue=""
                      >
                        <option value="" disabled>Load template...</option>
                        {Object.entries(INIT_SCRIPT_TEMPLATES).map(([key, tmpl]) => (
                          <option key={key} value={key}>{tmpl.name}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateInitScript}
                        disabled={isGeneratingInit}
                        className="h-8"
                      >
                        {isGeneratingInit ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        Generate
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Runs once when learner starts the lab. Must output JSON with URL and optional cookies.
                  </p>

                  {/* AI Context Input */}
                  <div className="space-y-1">
                    <Input
                      value={initAiContext}
                      onChange={(e) => setInitAiContext(e.target.value)}
                      placeholder="Describe what the script should do (for AI generation)..."
                      className="text-xs"
                    />
                  </div>

                  <textarea
                    id="initScript"
                    value={initScript}
                    onChange={(e) => setInitScript(e.target.value)}
                    placeholder="#!/bin/bash&#10;# Your initialization script here...&#10;&#10;echo '{&quot;url&quot;: &quot;https://example.com&quot;, &quot;cookies&quot;: []}'"
                    className="w-full h-48 px-3 py-2 rounded-md border border-input bg-background font-mono text-xs"
                  />

                  {/* AI Notes */}
                  {initAiNotes.length > 0 && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">Notes:</p>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                        {initAiNotes.map((note, i) => (
                          <li key={i}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Output format: {`{"url": "https://...", "cookies": [{"name": "...", "value": "..."}]}`}
                  </p>
                </div>
              </div>

              {/* Auto-Setup Configuration */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium">Automation</h3>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoRunSetup"
                    checked={autoRunSetup}
                    onChange={(e) => setAutoRunSetup(e.target.checked)}
                    className="rounded border-input"
                  />
                  <Label htmlFor="autoRunSetup" className="text-sm font-normal cursor-pointer">
                    Auto-run setup scripts when entering a step
                  </Label>
                </div>
              </div>

              {/* Auto-Login Configuration */}
              {appUrlTemplate && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium">Auto-Login</h3>

                  <div className="space-y-2">
                    <Label htmlFor="autoLoginType">Login Method</Label>
                    <select
                      id="autoLoginType"
                      value={autoLoginType}
                      onChange={(e) => setAutoLoginType(e.target.value as "none" | "url_params" | "cookies")}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="none">None</option>
                      <option value="url_params">URL Parameters</option>
                      <option value="cookies">Cookies (same-origin only)</option>
                    </select>
                  </div>

                  {autoLoginType === "url_params" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>URL Parameters</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAutoLoginParams([...autoLoginParams, { name: "", value: "" }])}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {autoLoginParams.map((param, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="param_name"
                            value={param.name}
                            onChange={(e) => {
                              const updated = [...autoLoginParams];
                              updated[index].name = e.target.value;
                              setAutoLoginParams(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="value"
                            value={param.value}
                            onChange={(e) => {
                              const updated = [...autoLoginParams];
                              updated[index].value = e.target.value;
                              setAutoLoginParams(updated);
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAutoLoginParams(autoLoginParams.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveTrackSettings}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedStep ? (
            <div className="flex flex-col h-full">
              {/* Step title bar */}
              <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
                <div className="flex-1">
                  <Input
                    id="stepTitle"
                    value={stepTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Step title"
                    className="text-lg font-medium h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <span className="text-xs text-orange-500">Unsaved changes</span>
                  )}
                  <Button onClick={handleSaveStep} disabled={isSaving} size="sm">
                    <Save className="h-4 w-4 mr-1" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* IDE */}
              <div className="flex-1 p-4">
                <StepIDE
                  stepTitle={stepTitle}
                  instructions={stepInstructions}
                  setupScript={setupScript}
                  validationScript={validationScript}
                  onInstructionsChange={handleInstructionsChange}
                  onSetupScriptChange={handleSetupScriptChange}
                  onValidationScriptChange={handleValidationScriptChange}
                  onHintsChange={handleHintsChange}
                  onSave={handleSaveStep}
                  isSaving={isSaving}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
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
