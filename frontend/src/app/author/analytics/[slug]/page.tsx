"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { analytics, TrackAnalytics, DropoffAnalysis } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  TrendingDown,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

export default function TrackAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user, token, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<TrackAnalytics | null>(null);
  const [dropoff, setDropoff] = useState<DropoffAnalysis | null>(null);
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
    if (token && slug) {
      Promise.all([
        analytics.getTrackAnalytics(slug, token),
        analytics.getDropoffAnalysis(slug, token),
      ])
        .then(([trackData, dropoffData]) => {
          setData(trackData);
          setDropoff(dropoffData);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"))
        .finally(() => setIsLoading(false));
    }
  }, [token, slug]);

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

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/author/analytics")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.track_title}</h1>
          <p className="text-muted-foreground">Track Analytics</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Enrollments</p>
                <p className="text-3xl font-bold">{data.total_enrollments}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.active_enrollments} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completions</p>
                <p className="text-3xl font-bold">{data.completions}</p>
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
                <p className={`text-3xl font-bold ${
                  data.completion_rate >= 70 ? "text-green-600" :
                  data.completion_rate >= 40 ? "text-yellow-600" :
                  "text-red-600"
                }`}>
                  {data.completion_rate}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Completion Time</p>
                <p className="text-3xl font-bold">
                  {data.avg_completion_time_hours
                    ? `${data.avg_completion_time_hours}h`
                    : "-"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drop-off Analysis */}
      {dropoff && dropoff.steps.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Learner Funnel
            </CardTitle>
            <CardDescription>
              See where learners are getting stuck
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dropoff.steps.map((step) => {
                const progressWidth = dropoff.total_enrollments > 0
                  ? ((step.passed + step.stuck) / dropoff.total_enrollments) * 100
                  : 0;

                return (
                  <div key={step.step_order} className="relative">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {step.step_order}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{step.step_title}</span>
                          <div className="flex items-center gap-4 text-sm">
                            {step.stuck > 0 && (
                              <span className="text-yellow-600">
                                {step.stuck} stuck
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {step.passed} passed
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {step.dropoff_rate > 20 && (
                      <div className="absolute right-0 top-0">
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          High drop-off
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step-by-Step Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Step Analytics</CardTitle>
          <CardDescription>
            Detailed performance metrics for each step
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.steps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No steps in this track yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Step</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Attempts</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Completions</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Rate</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Avg. Attempts</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Avg. Duration</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Common Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((step) => (
                    <tr key={step.step_id} className="border-b last:border-0">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                            {step.step_order}
                          </span>
                          <span className="font-medium">{step.step_title}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2">{step.attempts}</td>
                      <td className="text-right py-3 px-2">{step.completions}</td>
                      <td className="text-right py-3 px-2">
                        <span className={`${
                          step.completion_rate >= 70 ? "text-green-600" :
                          step.completion_rate >= 40 ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                          {step.completion_rate}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-2">{step.avg_attempts}</td>
                      <td className="text-right py-3 px-2">{formatDuration(step.avg_duration_ms)}</td>
                      <td className="py-3 px-2">
                        {step.common_errors.length > 0 ? (
                          <div className="space-y-1">
                            {step.common_errors.map((error, i) => (
                              <div
                                key={i}
                                className="text-xs text-red-600 bg-red-50 dark:bg-red-950 px-2 py-1 rounded truncate max-w-xs"
                                title={error}
                              >
                                {error}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push(`/author/${slug}`)}>
          Edit Track
        </Button>
      </div>
    </div>
  );
}
