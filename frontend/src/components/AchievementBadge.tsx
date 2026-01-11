"use client";

import { cn } from "@/lib/utils";
import { Achievement } from "@/lib/api";
import { Trophy, Rocket, Crown, Star, Medal, Award, Target, Zap } from "lucide-react";

interface AchievementBadgeProps {
  achievement: Achievement;
  earnedAt?: string;
  size?: "sm" | "md" | "lg";
  showXP?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  trophy: Trophy,
  rocket: Rocket,
  crown: Crown,
  star: Star,
  medal: Medal,
  award: Award,
  target: Target,
  zap: Zap,
};

const colorMap: Record<string, string> = {
  gold: "from-yellow-400 to-amber-500 text-yellow-900",
  blue: "from-blue-400 to-blue-600 text-blue-900",
  purple: "from-purple-400 to-purple-600 text-purple-900",
  yellow: "from-yellow-300 to-yellow-500 text-yellow-900",
  green: "from-green-400 to-green-600 text-green-900",
  red: "from-red-400 to-red-600 text-red-900",
};

const sizeClasses = {
  sm: {
    container: "w-12 h-12",
    icon: "h-5 w-5",
    text: "text-xs",
  },
  md: {
    container: "w-16 h-16",
    icon: "h-7 w-7",
    text: "text-sm",
  },
  lg: {
    container: "w-20 h-20",
    icon: "h-9 w-9",
    text: "text-base",
  },
};

export function AchievementBadge({
  achievement,
  earnedAt,
  size = "md",
  showXP = true,
}: AchievementBadgeProps) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const colorClass = colorMap[achievement.color] || colorMap.gold;
  const sizes = sizeClasses[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg",
          colorClass,
          sizes.container
        )}
      >
        <Icon className={sizes.icon} />
      </div>
      <div className="text-center">
        <p className={cn("font-semibold", sizes.text)}>{achievement.name}</p>
        {showXP && (
          <p className="text-xs text-muted-foreground">+{achievement.xp_value} XP</p>
        )}
        {earnedAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

interface AchievementCardProps {
  achievement: Achievement;
  earnedAt?: string;
  locked?: boolean;
}

export function AchievementCard({ achievement, earnedAt, locked }: AchievementCardProps) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const colorClass = colorMap[achievement.color] || colorMap.gold;

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border transition-all",
        locked ? "opacity-50 grayscale" : "hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center shadow",
            colorClass
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{achievement.name}</h3>
          <p className="text-sm text-muted-foreground">{achievement.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="font-medium text-primary">+{achievement.xp_value} XP</span>
            {earnedAt && (
              <span className="text-muted-foreground">
                Earned {new Date(earnedAt).toLocaleDateString()}
              </span>
            )}
            {locked && (
              <span className="text-muted-foreground">Locked</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
