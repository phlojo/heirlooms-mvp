// src/lib/supabase/action.ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export function getSupabaseActionClient() {
  const store = cookies() as any;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try { return store.get?.(name)?.value as string | undefined; } catch {}
          const all = store.getAll?.() as Array<{ name: string; value: string }> | undefined;
          return all?.find((c) => c.name === name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { /* @ts-ignore */ store.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { /* @ts-ignore */ store.set({ name, value: '', ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );
}
