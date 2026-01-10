"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tracks, Track } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";

export default function AuthorDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !user?.is_author) {
      router.push("/login");
      return;
    }

    tracks
      .listMy(token)
      .then(setTrackList)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token, user, authLoading, router]);

  const handleDelete = async (slug: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this track?")) return;

    try {
      await tracks.delete(slug, token);
      setTrackList((prev) => prev.filter((t) => t.slug !== slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Tracks</h1>
        <Link href="/author/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Track
          </Button>
        </Link>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {trackList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">You haven&apos;t created any tracks yet.</p>
          <Link href="/author/new">
            <Button>Create Your First Track</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trackList.map((track) => (
            <Card key={track.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{track.title}</CardTitle>
                    <CardDescription>/{track.slug}</CardDescription>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      track.is_published
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {track.is_published ? "Published" : "Draft"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {track.description || "No description"}
                </p>
                <div className="flex items-center gap-2">
                  <Link href={`/author/${track.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(track.slug)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
