"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizations, github, InviteCode, InviteCodeCreate, GitHubConnection } from "@/lib/api";
import { Github, Check, X, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // GitHub integration state
  const [githubConnection, setGithubConnection] = useState<GitHubConnection | null>(null);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [isDisconnectingGithub, setIsDisconnectingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (token) {
      Promise.all([
        organizations.listInviteCodes(token).catch(() => []),
        github.getConnection(token).catch(() => null),
      ]).then(([codes, connection]) => {
        setInviteCodes(codes);
        setGithubConnection(connection);
      }).finally(() => setIsLoading(false));
    }
  }, [token]);

  // Handle GitHub OAuth callback via URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state && token) {
      setIsConnectingGithub(true);
      github.callback(code, state, token)
        .then(() => {
          // Reload connection
          return github.getConnection(token);
        })
        .then((connection) => {
          setGithubConnection(connection);
          // Clean URL
          window.history.replaceState({}, "", "/settings");
        })
        .catch((err) => {
          setGithubError(err instanceof Error ? err.message : "Failed to connect GitHub");
        })
        .finally(() => setIsConnectingGithub(false));
    }
  }, [token]);

  const handleCreateCode = async () => {
    if (!token) return;
    setError(null);
    setIsCreating(true);

    try {
      const data: InviteCodeCreate = {};
      if (maxUses) data.max_uses = parseInt(maxUses);
      if (expiresInDays) data.expires_in_days = parseInt(expiresInDays);

      const newCode = await organizations.createInviteCode(data, token);
      setInviteCodes([newCode, ...inviteCodes]);
      setMaxUses("");
      setExpiresInDays("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite code");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (!token) return;
    try {
      await organizations.deleteInviteCode(code, token);
      setInviteCodes(inviteCodes.map(c =>
        c.code === code ? { ...c, is_active: false } : c
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate code");
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleConnectGithub = async () => {
    if (!token) return;
    setGithubError(null);
    setIsConnectingGithub(true);

    try {
      const { auth_url } = await github.getAuthUrl(token);
      window.location.href = auth_url;
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : "Failed to get auth URL");
      setIsConnectingGithub(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to disconnect GitHub?")) return;

    setIsDisconnectingGithub(true);
    try {
      await github.disconnect(token);
      setGithubConnection(null);
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setIsDisconnectingGithub(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Organization Info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Your current organization details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {user?.organization?.name}</p>
            <p><span className="font-medium">Slug:</span> {user?.organization?.slug}</p>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Integration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>
            Connect your GitHub account to sync tracks with repositories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {githubError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
              {githubError}
            </div>
          )}

          {isConnectingGithub ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to GitHub...
            </div>
          ) : githubConnection ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Github className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">@{githubConnection.github_username}</span>
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(githubConnection.connected_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGithub}
                disabled={isDisconnectingGithub}
              >
                {isDisconnectingGithub ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                Disconnect
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your GitHub account to push and pull track content from repositories.
              </p>
              <Button onClick={handleConnectGithub}>
                <Github className="h-4 w-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Codes</CardTitle>
          <CardDescription>
            Create invite links to add people to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Create new code */}
          <div className="border rounded-lg p-4 mb-6 bg-muted/30">
            <h3 className="font-medium mb-3">Create New Invite Code</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses (optional)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires">Expires In Days (optional)</Label>
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="Never"
                />
              </div>
            </div>
            <Button onClick={handleCreateCode} disabled={isCreating}>
              {isCreating ? "Creating..." : "Generate Invite Code"}
            </Button>
          </div>

          {/* List of codes */}
          <div className="space-y-3">
            {inviteCodes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No invite codes yet</p>
            ) : (
              inviteCodes.map((code) => (
                <div
                  key={code.id}
                  className={`border rounded-lg p-4 flex items-center justify-between ${
                    !code.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <div className="font-mono text-lg font-bold">{code.code}</div>
                    <div className="text-sm text-muted-foreground">
                      {code.uses} / {code.max_uses ?? "Unlimited"} uses
                      {code.expires_at && (
                        <span className="ml-2">
                          Expires: {new Date(code.expires_at).toLocaleDateString()}
                        </span>
                      )}
                      {!code.is_active && (
                        <span className="ml-2 text-destructive">Deactivated</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {code.is_active && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(code.code)}
                        >
                          {copiedCode === code.code ? "Copied!" : "Copy Link"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCode(code.code)}
                        >
                          Deactivate
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
