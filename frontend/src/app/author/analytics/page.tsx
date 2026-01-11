"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { analytics, OverviewAnalytics } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export default function AnalyticsOverviewPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<OverviewAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && !user.is_author) {
      router.push("/learn");
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (token) {
      analytics.getOverview(token)
        .then(setData)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"))
        .finally(() => setIsLoading(false));
    }
  }, [token]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const overallCompletionRate = data.total_enrollments > 0
    ? Math.round(data.total_completions / data.total_enrollments * 100)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track performance and learner progress
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/author")}>
          Back to Tracks
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tracks</p>
                <p className="text-3xl font-bold">{data.total_tracks}</p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.published_tracks} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Enrollments</p>
                <p className="text-3xl font-bold">{data.total_enrollments}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completions</p>
                <p className="text-3xl font-bold">{data.total_completions}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold">{overallCompletionRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Track List */}
      <Card>
        <CardHeader>
          <CardTitle>Track Performance</CardTitle>
          <CardDescription>
            Click on a track for detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.tracks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tracks yet. Create your first track to see analytics.</p>
              <Button className="mt-4" onClick={() => router.push("/author/new")}>
                Create Track
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.tracks.map((track) => (
                <Link
                  key={track.track_id}
                  href={`/author/analytics/${track.track_slug}`}
                  className="block"
                >
                  <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{track.track_title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {track.enrollments} enrollments
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Completions</p>
                          <p className="font-medium">{track.completions}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Rate</p>
                          <p className={`font-medium ${
                            track.completion_rate >= 70 ? "text-green-600" :
                            track.completion_rate >= 40 ? "text-yellow-600" :
                            "text-red-600"
                          }`}>
                            {track.completion_rate}%
                          </p>
                        </div>

                        {/* Progress bar */}
                        <div className="w-24">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                track.completion_rate >= 70 ? "bg-green-500" :
                                track.completion_rate >= 40 ? "bg-yellow-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${track.completion_rate}%` }}
                            />
                          </div>
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
