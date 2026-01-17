"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth, User, RegisterResponse } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, orgSlug?: string, inviteCode?: string) => Promise<RegisterResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (accessToken: string) => {
    try {
      const userData = await auth.me(accessToken);
      setUser(userData);
      setToken(accessToken);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      fetchUser(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const response = await auth.login({ email, password });
    localStorage.setItem("token", response.access_token);
    await fetchUser(response.access_token);
  };

  const register = async (email: string, password: string, name: string, orgSlug?: string, inviteCode?: string): Promise<RegisterResponse> => {
    const response = await auth.register({
      email,
      password,
      name,
      org_slug: orgSlug,
      invite_code: inviteCode
    });
    // Registration now returns pending status - no token until admin approves
    return response;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
