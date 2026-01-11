"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ResizablePaneProps {
  topContent: React.ReactNode;
  bottomContent: React.ReactNode;
  defaultTopHeight?: number; // percentage
  minTopHeight?: number; // percentage
  maxTopHeight?: number; // percentage
}

export function ResizablePane({
  topContent,
  bottomContent,
  defaultTopHeight = 60,
  minTopHeight = 20,
  maxTopHeight = 80,
}: ResizablePaneProps) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;

      if (newHeight >= minTopHeight && newHeight <= maxTopHeight) {
        setTopHeight(newHeight);
      }
    },
    [isDragging, minTopHeight, maxTopHeight]
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Top pane */}
      <div style={{ height: `${topHeight}%` }} className="overflow-hidden">
        {topContent}
      </div>

      {/* Resize handle */}
      <div
        className="h-1 bg-border hover:bg-primary/50 cursor-row-resize flex-shrink-0 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="h-full w-12 mx-auto flex items-center justify-center">
          <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full" />
        </div>
      </div>

      {/* Bottom pane */}
      <div style={{ height: `${100 - topHeight}%` }} className="overflow-hidden">
        {bottomContent}
      </div>
    </div>
  );
}
