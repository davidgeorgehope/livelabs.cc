"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function MarkdownAlternate() {
  const pathname = usePathname();

  useEffect(() => {
    // Only add for specific public pages that have markdown versions
    const publicPages = ["/"];
    if (!publicPages.includes(pathname)) return;

    const mdPath = pathname === "/" ? "/page.md" : pathname + ".md";

    // Check if link already exists
    const existing = document.querySelector('link[rel="alternate"][type="text/markdown"]');
    if (existing) {
      existing.setAttribute("href", mdPath);
      return;
    }

    // Create and append the link tag
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "text/markdown";
    link.href = mdPath;
    link.title = "Markdown version";
    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [pathname]);

  return null;
}
