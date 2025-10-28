// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client for:
 * - Server Components
 * - Route Handlers (API)
 * Next 16: cookies() is async; we adapt it for @supabase/ssr.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options?: CookieOptions) {
          cookieStore.set({ name, value: "", expires: new Date(0), ...options });
        },
      },
    }
  );

  return supabase;
}
