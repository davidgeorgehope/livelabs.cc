"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Track } from "@/lib/api";

interface TrackCardProps {
  track: Track;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

export function TrackCard({ track }: TrackCardProps) {
  return (
    <Link href={`/tracks/${track.slug}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{track.title}</CardTitle>
            {track.difficulty && (
              <span
                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  difficultyColors[track.difficulty] || "bg-gray-100 text-gray-800"
                }`}
              >
                {track.difficulty.charAt(0).toUpperCase() + track.difficulty.slice(1)}
              </span>
            )}
          </div>
          <CardDescription className="line-clamp-2">
            {track.description || "No description"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Tags */}
            {track.tags && track.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {track.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {track.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{track.tags.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {track.estimated_minutes && (
                <span>{track.estimated_minutes} min</span>
              )}
              {track.env_template?.length > 0 && (
                <span>{track.env_template.length} variable{track.env_template.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
