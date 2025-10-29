// src/app/login/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/src/lib/supabase/client";

function SearchParamsComponent({ onParams }: { onParams: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  onParams(searchParams);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [redirect, setRedirect] = useState("/");
  const supabase = getSupabaseBrowser();

  const handleSearchParams = (params: URLSearchParams) => {
    setRedirect(params.get("redirect") || "/");
  };

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signInGoogle() {
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
            redirect
          )}`,
        },
      });
      if (error) throw error;
      // Redirect happens to Google; no-op here.
    } catch (err: any) {
      setMsg(err.message || String(err));
      setBusy(false);
    }
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
            redirect
          )}`,
        },
      });
      if (error) throw error;
      setMsg("Magic link sent! Check your inbox.");
    } catch (err: any) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <Suspense>
        <SearchParamsComponent onParams={handleSearchParams} />
      </Suspense>
      <h1 className="text-2xl font-semibold">Sign in</h1>

      <button
        onClick={signInGoogle}
        disabled={busy}
        className="w-full rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        Continue with Google
      </button>

      <div className="text-center text-sm text-gray-500">or</div>

      <form onSubmit={signInEmail} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl border px-4 py-2 disabled:opacity-50"
        >
          Send magic link
        </button>
      </form>

      {msg && <div className="text-sm">{msg}</div>}

      <button
        onClick={() => router.push(redirect)}
        className="text-sm text-gray-600 underline"
      >
        Cancel
      </button>
    </main>
  );
}
