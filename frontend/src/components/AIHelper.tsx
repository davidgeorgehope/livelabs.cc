"use client";

import { useState } from "react";
import { ai } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { HelpCircle, Send, Loader2, AlertCircle, Lightbulb, X } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface AIHelperProps {
  stepTitle: string;
  stepInstructions: string;
  lastError?: string | null;
}

export function AIHelper({ stepTitle, stepInstructions, lastError }: AIHelperProps) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (question?: string, errorOutput?: string) => {
    if (!token) return;

    const userMessage = question || (errorOutput ? "Help me understand this error" : "I'm stuck and need a hint");

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await ai.getHelp(
        {
          step_title: stepTitle,
          step_instructions: stepInstructions,
          error_output: errorOutput || undefined,
          question: question || undefined,
        },
        token
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.response,
          suggestions: response.suggestions,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get help");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input.trim());
    }
  };

  const handleStuckClick = () => {
    sendMessage();
  };

  const handleErrorClick = () => {
    if (lastError) {
      sendMessage(undefined, lastError);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <HelpCircle className="h-4 w-4" />
          Need Help?
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Learning Assistant
          </SheetTitle>
          <SheetDescription>
            Get hints and guidance without spoiling the answer
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col mt-4 overflow-hidden">
          {/* Quick action buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStuckClick}
              disabled={isLoading}
              className="flex-1"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              I&apos;m Stuck
            </Button>
            {lastError && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleErrorClick}
                disabled={isLoading}
                className="flex-1"
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Explain Error
              </Button>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  Click &quot;I&apos;m Stuck&quot; for a hint, or ask a specific question below.
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-muted mr-8"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer content={msg.content} />
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Quick suggestions:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {msg.suggestions.slice(0, 3).map((suggestion, j) => (
                                <button
                                  key={j}
                                  onClick={() => setInput(suggestion)}
                                  className="text-xs bg-background hover:bg-accent px-2 py-1 rounded border"
                                >
                                  {suggestion.length > 40
                                    ? suggestion.slice(0, 40) + "..."
                                    : suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="bg-muted rounded-lg p-3 mr-8 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="mt-4 pt-4 border-t">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="mb-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear chat
              </Button>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a specific question..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-[60px]"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
