"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { enrollments, EnrollmentWithTrack } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LearnDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [enrollmentList, setEnrollmentList] = useState<EnrollmentWithTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push("/login");
      return;
    }

    enrollments
      .list(token)
      .then(setEnrollmentList)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token, authLoading, router]);

  if (authLoading || (!user && !isLoading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Learning</h1>
        <Link href="/">
          <Button variant="outline">Browse Tracks</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : enrollmentList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You haven&apos;t enrolled in any tracks yet.</p>
          <Link href="/">
            <Button>Browse Available Tracks</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enrollmentList.map((enrollment) => {
            const totalSteps = enrollment.track.env_template?.length || 1;
            const progress = enrollment.completed_at
              ? 100
              : Math.round(((enrollment.current_step - 1) / totalSteps) * 100);

            return (
              <Link key={enrollment.id} href={`/learn/${enrollment.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">{enrollment.track.title}</CardTitle>
                    <CardDescription>
                      {enrollment.completed_at ? (
                        <span className="text-green-600">Completed</span>
                      ) : (
                        `Step ${enrollment.current_step}`
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
