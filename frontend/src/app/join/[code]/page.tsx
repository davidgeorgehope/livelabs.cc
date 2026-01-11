"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizations, InviteCodeValidation } from "@/lib/api";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { register, user } = useAuth();

  const [validation, setValidation] = useState<InviteCodeValidation | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
  const isPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.digit;

  // Validate invite code on mount
  useEffect(() => {
    organizations.validateInviteCode(code)
      .then(setValidation)
      .catch(() => setValidation({
        valid: false,
        message: "Failed to validate invite code"
      }))
      .finally(() => setIsValidating(false));
  }, [code]);

  // If user is already logged in, redirect
  useEffect(() => {
    if (user) {
      router.push("/learn");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, name, undefined, code);
      router.push("/learn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Validating invite code...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{validation?.message || "This invite link is not valid"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The invite code may have expired, been deactivated, or reached its maximum uses.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/register">Create Account</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {validation.organization?.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
              <p className="text-sm font-medium">Organization</p>
              <p className="text-lg">{validation.organization?.name}</p>
            </div>

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

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isPasswordValid}
            >
              {isLoading ? "Creating account..." : "Join Organization"}
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
