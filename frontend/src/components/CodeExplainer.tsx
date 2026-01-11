"use client";

import { useState } from "react";
import { ai } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Code, Loader2, X } from "lucide-react";

interface CodeExplainerProps {
  context?: string;
}

export function CodeExplainer({ context }: CodeExplainerProps) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("bash");
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [lineByLine, setLineByLine] = useState<{ line: string; explanation: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleExplain = async () => {
    if (!token || !code.trim()) return;

    setIsLoading(true);
    setError(null);
    setExplanation(null);
    setLineByLine([]);

    try {
      const response = await ai.explainCode(
        {
          code: code.trim(),
          language,
          context: context || undefined,
        },
        token
      );

      setExplanation(response.explanation);
      setLineByLine(response.line_by_line);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to explain code");
    } finally {
      setIsLoading(false);
    }
  };

  const languages = [
    { value: "bash", label: "Bash/Shell" },
    { value: "python", label: "Python" },
    { value: "javascript", label: "JavaScript" },
    { value: "yaml", label: "YAML" },
    { value: "json", label: "JSON" },
    { value: "dockerfile", label: "Dockerfile" },
    { value: "sql", label: "SQL" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Code className="h-4 w-4" />
          Explain Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-500" />
            Code Explainer
          </DialogTitle>
          <DialogDescription>
            Paste code to get a detailed explanation
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {!explanation ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Code</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="h-8 px-2 rounded-md border border-input bg-background text-sm"
                  >
                    {languages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleExplain}
                disabled={isLoading || !code.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Code className="h-4 w-4 mr-2" />
                    Explain This Code
                  </>
                )}
              </Button>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExplanation(null);
                  setLineByLine([]);
                }}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Explain different code
              </Button>

              {/* Code snippet */}
              <div className="bg-muted rounded-lg p-3">
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {code}
                </pre>
              </div>

              {/* Explanation */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownRenderer content={explanation} />
              </div>

              {/* Line by line breakdown */}
              {lineByLine.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Line-by-Line Breakdown</h4>
                  <div className="space-y-2">
                    {lineByLine.map((item, i) => (
                      <div
                        key={i}
                        className="bg-muted/50 rounded-lg p-3 text-sm"
                      >
                        <code className="text-xs font-mono text-primary">
                          {item.line}
                        </code>
                        <p className="mt-1 text-muted-foreground">
                          {item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
