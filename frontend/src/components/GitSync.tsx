"use client";

import { useState, useEffect } from "react";
import { github, GitHubRepo, TrackGitSync, GitHubConnection } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Github,
  GitBranch,
  Upload,
  Download,
  Settings,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";

interface GitSyncProps {
  trackSlug: string;
}

export function GitSync({ trackSlug }: GitSyncProps) {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [syncConfig, setSyncConfig] = useState<TrackGitSync | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Setup form state
  const [showSetup, setShowSetup] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branch, setBranch] = useState("main");

  const loadData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const [conn, sync] = await Promise.all([
        github.getConnection(token).catch(() => null),
        github.getTrackSync(trackSlug, token).catch(() => null),
      ]);

      setConnection(conn);
      setSyncConfig(sync);

      // Load repos if connected
      if (conn) {
        const repoList = await github.listRepos(token).catch(() => []);
        setRepos(repoList);
      }
    } catch {
      setError("Failed to load sync status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, token, trackSlug]);

  const handleSetupSync = async () => {
    if (!token || !selectedRepo) return;

    setIsSettingUp(true);
    setError(null);

    try {
      const [owner, name] = selectedRepo.split("/");
      const sync = await github.setupTrackSync(
        trackSlug,
        { repo_owner: owner, repo_name: name, branch },
        token
      );
      setSyncConfig(sync);
      setShowSetup(false);
      setSuccessMessage("Sync configured successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to setup sync");
    } finally {
      setIsSettingUp(false);
    }
  };

  const handlePush = async () => {
    if (!token) return;

    setIsPushing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await github.pushTrack(trackSlug, token);
      setSyncConfig((prev) =>
        prev
          ? { ...prev, last_sync_at: new Date().toISOString(), last_sync_sha: result.commit_sha }
          : prev
      );
      setSuccessMessage(`Pushed to ${result.file_path}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push");
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!token) return;
    if (!confirm("This will overwrite your local track with the GitHub version. Continue?")) {
      return;
    }

    setIsPulling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await github.pullTrack(trackSlug, token);
      setSyncConfig((prev) =>
        prev
          ? { ...prev, last_sync_at: new Date().toISOString(), last_sync_sha: result.commit_sha }
          : prev
      );
      setSuccessMessage("Track updated from GitHub. Refresh the page to see changes.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pull");
    } finally {
      setIsPulling(false);
    }
  };

  const handleRemoveSync = async () => {
    if (!token) return;
    if (!confirm("Remove sync configuration?")) return;

    try {
      await github.removeTrackSync(trackSlug, token);
      setSyncConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove sync");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Github className="h-4 w-4" />
          Git Sync
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Sync
          </DialogTitle>
          <DialogDescription>
            Sync this track with a GitHub repository
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !connection ? (
            <div className="text-center py-4">
              <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Connect your GitHub account in Settings to use sync.
              </p>
              <Button variant="outline" onClick={() => (window.location.href = "/settings")}>
                Go to Settings
              </Button>
            </div>
          ) : showSetup ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Repository</Label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.full_name}>
                        {repo.full_name}
                        {repo.private && " (private)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Branch</Label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSetup(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSetupSync}
                  disabled={!selectedRepo || isSettingUp}
                >
                  {isSettingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Setup Sync
                </Button>
              </div>
            </div>
          ) : syncConfig ? (
            <div className="space-y-4">
              {/* Sync status */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {syncConfig.repo_owner}/{syncConfig.repo_name}
                  </span>
                  <span className="text-muted-foreground">:{syncConfig.branch}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last synced: {formatDate(syncConfig.last_sync_at)}
                </p>
                {syncConfig.last_sync_sha && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {syncConfig.last_sync_sha.substring(0, 7)}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handlePush}
                  disabled={isPushing || isPulling}
                >
                  {isPushing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Push
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePull}
                  disabled={isPushing || isPulling}
                >
                  {isPulling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Pull
                </Button>
              </div>

              {/* Settings */}
              <div className="flex justify-between items-center pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSetup(true)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Change Repo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={handleRemoveSync}
                >
                  Remove Sync
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                No sync configured for this track.
              </p>
              <Button onClick={() => setShowSetup(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Setup Sync
              </Button>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg text-sm">
              <Check className="h-4 w-4 flex-shrink-0" />
              {successMessage}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
