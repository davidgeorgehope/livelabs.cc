"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AppContainerStatus, appContainer } from "@/lib/api";
import { RefreshCw, Play, Loader2, AlertCircle, ExternalLink, Globe, RotateCcw } from "lucide-react";

interface AppWindowProps {
  enrollmentId: number;
  token: string;
  onStatusChange?: (status: AppContainerStatus) => void;
}

export function AppWindow({ enrollmentId, token, onStatusChange }: AppWindowProps) {
  const [status, setStatus] = useState<AppContainerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await appContainer.getStatus(enrollmentId, token);
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get app status");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, token, onStatusChange]);

  // Run initialization when needed
  const runInit = useCallback(async () => {
    setInitializing(true);
    setError(null);
    try {
      const result = await appContainer.init(enrollmentId, token);
      if (result.status === "success") {
        // Refresh status to get the updated URL
        await fetchStatus();
      } else if (result.status === "failed") {
        setError(result.error || "Initialization failed");
        // Refresh status to show init_failed state
        await fetchStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialization failed");
      await fetchStatus();
    } finally {
      setInitializing(false);
    }
  }, [enrollmentId, token, fetchStatus]);

  // Initial load and handle init states
  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const init = async () => {
      const data = await fetchStatus();
      if (!mounted || !data) return;

      // If needs init, trigger it automatically
      if (data.status === "needs_init") {
        runInit();
      }
    };

    init();

    // Poll while initializing or starting
    pollInterval = setInterval(async () => {
      if (!mounted) return;
      if (status?.status === "initializing" || status?.status === "starting") {
        await fetchStatus();
      }
    }, 2000);

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [enrollmentId, token]); // Only re-run on enrollment change

  // Separate effect for polling during init/starting states
  useEffect(() => {
    if (status?.status !== "initializing" && status?.status !== "starting") return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [status?.status, fetchStatus]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const data = await appContainer.start(enrollmentId, token);
      setStatus(data);
      onStatusChange?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start app");
    } finally {
      setStarting(false);
    }
  };

  const handleRestart = async () => {
    setStarting(true);
    setError(null);
    setIframeLoaded(false);
    try {
      const data = await appContainer.restart(enrollmentId, token);
      setStatus(data);
      onStatusChange?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart app");
    } finally {
      setStarting(false);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIframeLoaded(false);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenExternal = () => {
    if (status?.url) {
      window.open(status.url, "_blank");
    }
  };

  // Set auto-login cookies if configured
  useEffect(() => {
    if (status?.cookies?.length) {
      status.cookies.forEach((cookie) => {
        document.cookie = `${cookie.name}=${cookie.value}${cookie.domain ? `; domain=${cookie.domain}` : ""}; path=/`;
      });
    }
  }, [status?.cookies]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading app...</span>
        </div>
      </div>
    );
  }

  // No app configured
  if (!status?.has_app) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground max-w-md text-center p-6">
          <Globe className="h-12 w-12 opacity-50" />
          <h3 className="font-medium text-foreground">No App Configured</h3>
          <p className="text-sm">
            This track doesn&apos;t have an app window configured. Follow the instructions and use the terminal to complete the lab.
          </p>
        </div>
      </div>
    );
  }

  // Lab needs initialization (auto-triggered, show loading)
  if (status.status === "needs_init" || initializing) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Initializing Lab Environment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Setting up your sandbox environment...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take a moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Lab is initializing (from backend status)
  if (status.status === "initializing") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Initializing Lab Environment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Setting up your sandbox environment...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take a moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Lab initialization failed
  if (status.status === "init_failed") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center p-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Initialization Failed</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We couldn&apos;t set up your lab environment.
            </p>
            {(status.error || error) && (
              <div className="mt-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <p className="text-xs text-destructive font-mono text-left whitespace-pre-wrap">
                  {status.error || error}
                </p>
              </div>
            )}
          </div>
          <Button onClick={runInit} disabled={initializing} variant="outline">
            {initializing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Initialization
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // App needs to be started
  if (status.status === "stopped" && status.type === "container") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-lg">Start Lab Environment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click below to start the application container
            </p>
          </div>
          <Button onClick={handleStart} disabled={starting} size="lg">
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start App
              </>
            )}
          </Button>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // App is starting
  if (status.status === "starting") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-medium">Starting Application</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // App failed
  if (status.status === "failed") {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-medium text-lg">Application Failed</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {status.message || "The application container failed to start"}
            </p>
          </div>
          {status.can_restart && (
            <Button onClick={handleRestart} disabled={starting} variant="outline">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart App
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // App is running - show iframe
  if (status.url) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <Globe className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{status.url}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 w-7 p-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenExternal} className="h-7 w-7 p-0">
              <ExternalLink className="h-4 w-4" />
            </Button>
            {status.type === "container" && status.can_restart && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestart}
                disabled={starting}
                className="h-7 px-2 text-xs"
              >
                {starting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Restart"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Iframe container */}
        <div className="flex-1 relative bg-white">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading application...</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={status.url}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoaded(true)}
            allow="clipboard-write; clipboard-read"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>

        {error && (
          <div className="px-3 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-full flex items-center justify-center bg-muted/30">
      <div className="text-muted-foreground">Unable to load application</div>
    </div>
  );
}
