"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { achievements as achievementsApi, Achievement, UserStats, enrollments as enrollmentsApi, EnrollmentWithTrack } from "@/lib/api";
import { AchievementBadge, AchievementCard } from "@/components/AchievementBadge";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Target, Award, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [completedEnrollments, setCompletedEnrollments] = useState<EnrollmentWithTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      router.push("/login");
      return;
    }

    const loadData = async () => {
      try {
        const [statsData, allAchievementsData, enrollmentsData] = await Promise.all([
          achievementsApi.getMyStats(token),
          achievementsApi.listAll(),
          enrollmentsApi.list(token, { status: "completed", page_size: 100 }),
        ]);
        setStats(statsData);
        setAllAchievements(allAchievementsData);
        setCompletedEnrollments(enrollmentsData.items);
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const earnedAchievementIds = new Set(stats?.achievements.map(a => a.achievement.id) || []);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted-foreground">
          {user?.email}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-6 rounded-lg border bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500 text-white">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total_xp || 0}</p>
              <p className="text-sm text-muted-foreground">Total XP</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500 text-white">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.tracks_completed || 0}</p>
              <p className="text-sm text-muted-foreground">Tracks Completed</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-500 text-white">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.achievements_count || 0}</p>
              <p className="text-sm text-muted-foreground">Achievements</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earned Achievements */}
      {stats && stats.achievements.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5" />
            Your Achievements
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {stats.achievements.map((ua) => (
              <AchievementBadge
                key={ua.id}
                achievement={ua.achievement}
                earnedAt={ua.earned_at}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Achievements */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">All Achievements</h2>
        <div className="space-y-3">
          {allAchievements.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              earnedAt={stats?.achievements.find(a => a.achievement.id === achievement.id)?.earned_at}
              locked={!earnedAchievementIds.has(achievement.id)}
            />
          ))}
        </div>
      </div>

      {/* Completed Tracks with Certificates */}
      {completedEnrollments.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Certificates</h2>
          <div className="space-y-3">
            {completedEnrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="p-4 rounded-lg border flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium">{enrollment.track.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Completed {new Date(enrollment.completed_at!).toLocaleDateString()}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/profile/certificate/${enrollment.id}`}>
                    <Award className="h-4 w-4 mr-2" />
                    View Certificate
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {(!stats || stats.achievements.length === 0) && completedEnrollments.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No achievements yet</h3>
          <p className="text-muted-foreground mb-4">
            Complete tracks to earn achievements and XP!
          </p>
          <Button asChild>
            <Link href="/">
              Browse Tracks
              <ExternalLink className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
