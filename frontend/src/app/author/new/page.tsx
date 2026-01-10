"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tracks, EnvVar } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

export default function CreateTrackPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [dockerImage, setDockerImage] = useState("livelabs-runner:latest");
  const [envTemplate, setEnvTemplate] = useState<EnvVar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const addEnvVar = () => {
    setEnvTemplate([...envTemplate, { name: "", description: "", required: true }]);
  };

  const updateEnvVar = (index: number, field: keyof EnvVar, value: string | boolean) => {
    const updated = [...envTemplate];
    updated[index] = { ...updated[index], [field]: value };
    setEnvTemplate(updated);
  };

  const removeEnvVar = (index: number) => {
    setEnvTemplate(envTemplate.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsLoading(true);

    try {
      const track = await tracks.create(
        {
          title,
          slug,
          description,
          docker_image: dockerImage,
          env_template: envTemplate.filter((e) => e.name.trim()),
        },
        token
      );
      router.push(`/author/${track.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create track");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create New Track</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g., Elastic Observability 101"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., elastic-observability-101"
                  required
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (lowercase letters, numbers, hyphens only)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will learners accomplish in this track?"
                  className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dockerImage">Docker Image</Label>
                <Input
                  id="dockerImage"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder="livelabs-runner:latest"
                />
                <p className="text-xs text-muted-foreground">
                  The Docker image used to run scripts
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Environment Variables</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addEnvVar}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Variable
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {envTemplate.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No environment variables configured. Add variables that learners need to provide.
                </p>
              ) : (
                <div className="space-y-4">
                  {envTemplate.map((envVar, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={envVar.name}
                          onChange={(e) => updateEnvVar(index, "name", e.target.value)}
                          placeholder="Variable name (e.g., ES_URL)"
                        />
                        <Input
                          value={envVar.description}
                          onChange={(e) => updateEnvVar(index, "description", e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEnvVar(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Track"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
