"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { AITrackAssistant } from "./AITrackAssistant";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface FileTab {
  id: string;
  label: string;
  language: string;
  icon: string;
}

interface StepIDEProps {
  stepTitle?: string;
  instructions: string;
  setupScript: string;
  validationScript: string;
  onInstructionsChange: (value: string) => void;
  onSetupScriptChange: (value: string) => void;
  onValidationScriptChange: (value: string) => void;
  onHintsChange?: (hints: string[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
}

const FILE_TABS: FileTab[] = [
  { id: "instructions", label: "instructions.md", language: "markdown", icon: "M" },
  { id: "setup", label: "setup.sh", language: "shell", icon: "S" },
  { id: "validation", label: "validate.sh", language: "shell", icon: "V" },
];

export function StepIDE({
  stepTitle = "Untitled Step",
  instructions,
  setupScript,
  validationScript,
  onInstructionsChange,
  onSetupScriptChange,
  onValidationScriptChange,
  onHintsChange,
  onSave,
  isSaving = false,
  hasUnsavedChanges = false,
}: StepIDEProps) {
  const [activeTab, setActiveTab] = useState<string>("instructions");
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Get current value and handler based on active tab
  const getCurrentValue = () => {
    switch (activeTab) {
      case "instructions":
        return instructions;
      case "setup":
        return setupScript;
      case "validation":
        return validationScript;
      default:
        return "";
    }
  };

  const handleChange = (value: string) => {
    switch (activeTab) {
      case "instructions":
        onInstructionsChange(value);
        break;
      case "setup":
        onSetupScriptChange(value);
        break;
      case "validation":
        onValidationScriptChange(value);
        break;
    }

    // Auto-save after 2 seconds of inactivity
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    const timer = setTimeout(() => {
      if (onSave) {
        onSave();
        setLastSaved(new Date());
      }
    }, 2000);
    setAutoSaveTimer(timer);
  };

  // Clear auto-save timer when save completes (hasUnsavedChanges becomes false)
  // This prevents stale saves after manual save or navigation
  useEffect(() => {
    if (!hasUnsavedChanges && autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      setAutoSaveTimer(null);
    }
  }, [hasUnsavedChanges, autoSaveTimer]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (onSave && hasUnsavedChanges) {
          onSave();
          setLastSaved(new Date());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, hasUnsavedChanges]);

  const getLanguage = () => {
    const tab = FILE_TABS.find((t) => t.id === activeTab);
    return tab?.language || "plaintext";
  };

  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (seconds < 5) return "Saved just now";
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  };

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="flex items-center justify-between bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex">
          {FILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm border-r border-[#3c3c3c] transition-colors",
                activeTab === tab.id
                  ? "bg-[#1e1e1e] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#2d2d2d]"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded text-xs flex items-center justify-center font-mono",
                  tab.id === "instructions" && "bg-blue-600",
                  tab.id === "setup" && "bg-green-600",
                  tab.id === "validation" && "bg-orange-600"
                )}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-4 text-xs text-gray-400">
          <AITrackAssistant
            stepTitle={stepTitle}
            currentInstructions={instructions}
            currentSetupScript={setupScript}
            currentValidationScript={validationScript}
            onApplyInstructions={onInstructionsChange}
            onApplySetup={onSetupScriptChange}
            onApplyValidation={(script, newHints) => {
              onValidationScriptChange(script);
              if (onHintsChange) {
                onHintsChange(newHints);
              }
            }}
            onApplyHints={onHintsChange}
          />
          {isSaving && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Saving...
            </span>
          )}
          {!isSaving && hasUnsavedChanges && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              Unsaved
            </span>
          )}
          {!isSaving && !hasUnsavedChanges && lastSaved && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {formatLastSaved()}
            </span>
          )}
          <span className="text-gray-500">Ctrl+S to save</span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={getLanguage()}
          value={getCurrentValue()}
          onChange={(val) => handleChange(val || "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8 },
            renderLineHighlight: "all",
            cursorBlinking: "smooth",
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1 bg-[#007acc] text-white text-xs">
        <div className="flex items-center gap-4">
          <span>{getLanguage() === "markdown" ? "Markdown" : "Shell Script"}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            {activeTab === "instructions"
              ? "Write step instructions in Markdown"
              : activeTab === "setup"
              ? "Script runs when learner clicks 'Run Setup'"
              : "Exit code 0 = pass, non-zero = fail"}
          </span>
        </div>
      </div>
    </div>
  );
}
