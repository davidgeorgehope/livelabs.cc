"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout, isLoading } = useAuth();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl">
            LiveLabs
          </Link>
          {user && (
            <nav className="flex items-center gap-4">
              <Link href="/learn" className="text-sm text-muted-foreground hover:text-foreground">
                My Learning
              </Link>
              {user.is_author && (
                <Link href="/author" className="text-sm text-muted-foreground hover:text-foreground">
                  Author
                </Link>
              )}
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                Profile
              </Link>
              <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
                Settings
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user.name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
