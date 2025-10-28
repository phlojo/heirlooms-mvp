"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/src/lib/supabase/client";

type User = { email?: string | null };

export default function AuthButtons() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = getSupabaseBrowser().auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  if (!user) {
    return (
      <a href="/login" className="text-sm text-gray-600 hover:text-black">
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">{user.email}</span>
      <button onClick={signOut} className="px-3 py-1 rounded border">
        Sign out
      </button>
    </div>
  );
}
