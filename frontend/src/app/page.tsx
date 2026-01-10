"use client";

import { useEffect, useState } from "react";
import { tracks, Track } from "@/lib/api";
import { TrackCard } from "@/components/TrackCard";

export default function HomePage() {
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tracks
      .listPublic()
      .then(setTrackList)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Learn by Doing</h1>
        <p className="text-lg text-muted-foreground">
          Hands-on guided labs on real SaaS products. No simulations, no VMs - work directly
          with production APIs and see real results.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : trackList.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No tracks available yet. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trackList.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
