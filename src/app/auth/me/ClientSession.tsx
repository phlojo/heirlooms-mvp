// src/app/auth/me/ClientSession.tsx
"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/src/lib/supabase/client";

export default function ClientSession() {
  const supabase = getSupabaseBrowser();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (mounted) setSession(s);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  return (
    <pre className="p-3 rounded-xl border overflow-auto text-xs">
      {JSON.stringify({ client_session: session }, null, 2)}
    </pre>
  );
}
