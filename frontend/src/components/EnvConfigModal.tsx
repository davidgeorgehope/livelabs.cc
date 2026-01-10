"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnvVar } from "@/lib/api";

interface EnvConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envTemplate: EnvVar[];
  onSubmit: (environment: Record<string, string>) => void;
  isLoading?: boolean;
}

export function EnvConfigModal({
  open,
  onOpenChange,
  envTemplate,
  onSubmit,
  isLoading,
}: EnvConfigModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const updateValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const isValid = envTemplate
    .filter((v) => v.required)
    .every((v) => values[v.name]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Configure Environment</DialogTitle>
            <DialogDescription>
              Enter the required environment variables to start this track.
              These values will be securely stored and used when running scripts.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {envTemplate.map((envVar) => (
              <div key={envVar.name} className="space-y-2">
                <Label htmlFor={envVar.name}>
                  {envVar.name}
                  {envVar.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {envVar.description && (
                  <p className="text-xs text-muted-foreground">{envVar.description}</p>
                )}
                <Input
                  id={envVar.name}
                  type="password"
                  value={values[envVar.name] || ""}
                  onChange={(e) => updateValue(envVar.name, e.target.value)}
                  placeholder={`Enter ${envVar.name}`}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? "Starting..." : "Start Track"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
