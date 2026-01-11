"use client";

import { useEffect, useState, useCallback } from "react";
import { tracks, Track, TrackSearchParams } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { MarketingLanding } from "@/components/MarketingLanding";
import { TrackCard } from "@/components/TrackCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function HomePage() {
  const { user, token, isLoading: authLoading } = useAuth();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Not logged in = marketing page
  if (!user || !token) {
    return <MarketingLanding />;
  }

  // Logged in = track catalog
  return <TrackCatalog token={token} />;
}

function TrackCatalog({ token }: { token: string }) {
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTracks, setTotalTracks] = useState(0);
  const pageSize = 12;

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");

  const loadTracks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params: TrackSearchParams = { sort: sortBy, page: currentPage, page_size: pageSize };
    if (searchQuery) params.q = searchQuery;
    if (selectedTag) params.tag = selectedTag;
    if (selectedDifficulty) params.difficulty = selectedDifficulty;

    try {
      const [trackData, tagsData] = await Promise.all([
        tracks.list(params, token),
        tracks.listTags(token)
      ]);
      setTrackList(trackData.items);
      setTotalPages(trackData.pages);
      setTotalTracks(trackData.total);
      setAllTags(tagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracks");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTag, selectedDifficulty, sortBy, currentPage, token]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTracks();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTag(null);
    setSelectedDifficulty(null);
    setSortBy("newest");
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTag, selectedDifficulty, sortBy]);

  const hasActiveFilters = searchQuery || selectedTag || selectedDifficulty || sortBy !== "newest";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Your Learning Tracks</h1>
        <p className="text-lg text-muted-foreground">
          Hands-on guided labs with real terminal environments. Choose a track and start learning.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="max-w-4xl mx-auto mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-wrap gap-4 items-center">
          {/* Tags filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Tags:</span>
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}

          {/* Difficulty filter */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Difficulty:</span>
            {["beginner", "intermediate", "advanced"].map((level) => (
              <Button
                key={level}
                variant={selectedDifficulty === level ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDifficulty(selectedDifficulty === level ? null : level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex gap-2 items-center ml-auto">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "title")}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>

        {(hasActiveFilters || totalTracks > 0) && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {totalTracks} result{totalTracks !== 1 ? "s" : ""}
              {totalPages > 1 && ` (page ${currentPage} of ${totalPages})`}
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Track List */}
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
          {hasActiveFilters
            ? "No tracks match your search. Try different filters."
            : "No tracks available yet. Check back soon!"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trackList.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
