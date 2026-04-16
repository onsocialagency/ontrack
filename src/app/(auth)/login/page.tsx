"use client";

import { Suspense, useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (redirectPath && !redirectPath.startsWith("/master")) {
      const match = redirectPath.match(/^\/([a-z0-9_-]+)/);
      if (match) setUsername(match[1]);
    }
  }, [redirectPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(redirectPath || data.redirect);
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
      {/* OnSocial logomark */}
      <div className="flex justify-center mb-4">
        <svg
          width="48"
          height="48"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="30" cy="55" r="28" fill="#FF6A41" />
          <path d="M52,55 a25,25 0 0,1 50,0 L52,55 Z" fill="#FF6A41" />
        </svg>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          On<span className="text-[#FF6A41]">Track</span>
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Sign in to your dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="username"
            className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            placeholder="Enter your username"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#FF6A41]/50 focus:ring-1 focus:ring-[#FF6A41]/30"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-[#FF6A41]/50 focus:ring-1 focus:ring-[#FF6A41]/30"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#FF6A41] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#FF6A41]/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F] px-4">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl text-center">
              <div className="animate-pulse text-zinc-400">Loading...</div>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <p className="text-center text-xs text-zinc-600 mt-6">
          Powered by{" "}
          <a
            href="https://onsocial.agency"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 hover:text-[#FF6A41] transition-colors"
          >
            OnSocial
          </a>
        </p>
      </div>
    </div>
  );
}
