"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tracks, enrollments, TrackWithSteps } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvConfigModal } from "@/components/EnvConfigModal";

export default function TrackPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const [track, setTrack] = useState<TrackWithSteps | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const slug = params.slug as string;

  useEffect(() => {
    tracks
      .get(slug, token || undefined)
      .then(setTrack)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [slug, token]);

  const handleEnroll = async (environment: Record<string, string>) => {
    if (!token) {
      router.push("/login");
      return;
    }

    setIsEnrolling(true);
    try {
      const enrollment = await enrollments.create({ track_slug: slug, environment }, token);
      router.push(`/learn/${enrollment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
      setIsEnrolling(false);
    }
  };

  const handleStartClick = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowEnvModal(true);
  };

  if (isLoading) {
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
          <span className="text-sm text-muted-foreground">
            {track.steps.length} steps
          </span>
          <span className="text-sm text-muted-foreground">
            By {track.author?.name || "Unknown"}
          </span>
        </div>

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

        {track.env_template && track.env_template.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Required Configuration</CardTitle>
              <CardDescription>
                You&apos;ll need to provide these values to start the track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {track.env_template.map((env) => (
                  <li key={env.name} className="flex items-start gap-2">
                    <code className="bg-muted px-2 py-0.5 rounded text-sm">{env.name}</code>
                    {env.description && (
                      <span className="text-sm text-muted-foreground">{env.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Button size="lg" onClick={handleStartClick}>
          {user ? "Start Track" : "Login to Start"}
        </Button>
      </div>

      <EnvConfigModal
        open={showEnvModal}
        onOpenChange={setShowEnvModal}
        envTemplate={track.env_template || []}
        onSubmit={handleEnroll}
        isLoading={isEnrolling}
      />
    </div>
  );
}
