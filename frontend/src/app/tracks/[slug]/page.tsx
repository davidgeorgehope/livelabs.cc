"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tracks, enrollments, TrackWithSteps } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrackPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const [track, setTrack] = useState<TrackWithSteps | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const slug = params.slug as string;

  useEffect(() => {
    // Wait for auth to complete
    if (authLoading) return;

    // Redirect to login if not authenticated
    if (!token) {
      router.push("/login");
      return;
    }

    // Fetch track (now requires auth)
    tracks
      .get(slug, token)
      .then(setTrack)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [slug, token, authLoading, router]);

  const handleStartClick = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    setIsEnrolling(true);
    try {
      const enrollment = await enrollments.create(slug, token);
      router.push(`/learn/${enrollment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
      setIsEnrolling(false);
    }
  };

  // Show loading while checking auth
  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="h-4 w-full bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">{error || "Track not found"}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">{track.title}</h1>
        <p className="text-muted-foreground mb-6">{track.description}</p>

        <div className="flex items-center gap-4 mb-8">
          {track.difficulty && (
            <span className={`text-sm px-2 py-1 rounded ${
              track.difficulty === "beginner" ? "bg-green-100 text-green-800" :
              track.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              {track.difficulty.charAt(0).toUpperCase() + track.difficulty.slice(1)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {track.steps.length} steps
          </span>
          {track.estimated_minutes && (
            <span className="text-sm text-muted-foreground">
              ~{track.estimated_minutes} min
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            By {track.author?.name || "Unknown"}
          </span>
        </div>

        {track.tags && track.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {track.tags.map((tag) => (
              <span key={tag} className="text-xs bg-muted px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">What you&apos;ll learn</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {track.steps.map((step) => (
                <li key={step.id} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm">
                    {step.order}
                  </span>
                  <span>{step.title}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Button size="lg" onClick={handleStartClick} disabled={isEnrolling}>
          {isEnrolling ? "Starting..." : "Start Track"}
        </Button>
      </div>
    </div>
  );
}
