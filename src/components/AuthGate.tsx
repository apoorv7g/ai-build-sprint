"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AuthUser {
  id: string;
  username: string;
}

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshMe = async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) {
      setUser(null);
      return;
    }
    const data = await res.json();
    setUser(data?.authenticated ? data.user : null);
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Authentication failed");
        return;
      }
      setUsername("");
      setPassword("");
      await refreshMe();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading secure workspace...</div>;
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-border/60 bg-card/90 p-6 shadow-lg">
        <h2 className="text-2xl font-semibold">Welcome to Cache Memory</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with username/password to access your claim workspace.
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={mode === "login" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("login")}
          >
            Login
          </Button>
          <Button
            type="button"
            variant={mode === "register" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("register")}
          >
            Register
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="apoorv"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Auth error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/80 p-3">
        <div className="text-sm">
          Signed in as <span className="font-semibold">{user.username}</span>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout} disabled={submitting}>
          Logout
        </Button>
      </div>
      {children}
    </div>
  );
}
