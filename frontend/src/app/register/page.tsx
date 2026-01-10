"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizations, OrganizationPublic } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgMode, setOrgMode] = useState<"create" | "join">("create");
  const [newOrgName, setNewOrgName] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [availableOrgs, setAvailableOrgs] = useState<OrganizationPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
  const isPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.digit;

  // Fetch available organizations on mount
  useEffect(() => {
    organizations.listPublic()
      .then(setAvailableOrgs)
      .catch(() => setAvailableOrgs([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    try {
      // If joining an existing org, pass the slug
      // If creating new, pass undefined (backend will auto-create)
      const orgSlug = orgMode === "join" ? selectedOrg : undefined;
      await register(email, password, name, orgSlug);
      router.push("/learn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up to start learning</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                required
              />
              <div className="text-xs space-y-1">
                <p className={passwordChecks.length ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.length ? "\u2713" : "\u2022"} At least 8 characters
                </p>
                <p className={passwordChecks.uppercase ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.uppercase ? "\u2713" : "\u2022"} At least one uppercase letter
                </p>
                <p className={passwordChecks.digit ? "text-green-600" : "text-muted-foreground"}>
                  {passwordChecks.digit ? "\u2713" : "\u2022"} At least one number
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Organization</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={orgMode === "create" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrgMode("create")}
                  className="flex-1"
                >
                  Create New
                </Button>
                <Button
                  type="button"
                  variant={orgMode === "join" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrgMode("join")}
                  className="flex-1"
                  disabled={availableOrgs.length === 0}
                >
                  Join Existing
                </Button>
              </div>

              {orgMode === "create" ? (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization name (optional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate from your email
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    required={orgMode === "join"}
                  >
                    <option value="">Select an organization...</option>
                    {availableOrgs.map((org) => (
                      <option key={org.slug} value={org.slug}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isPasswordValid}
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
