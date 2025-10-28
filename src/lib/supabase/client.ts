// src/lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase for use in Client Components.
 */
export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
