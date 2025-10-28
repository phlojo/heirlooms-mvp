// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// sanitize "john.smith+foo" -> "john.smith", then keep a-z0-9._-
function emailLocalPart(email?: string | null) {
  if (!email) return null;
  const local = email.split("@")[0] || "";
  return local.replace(/\+.*/, ""); // drop +tag
}
function sanitizeUsername(s: string) {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  // ensure not empty
  return cleaned || `user_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureUniqueUsername(
  supabase: ReturnType<typeof createServerClient>,
  base: string,
  selfId: string
): Promise<string> {
  let candidate = sanitizeUsername(base);
  // check collisions
  let suffix = 0;
  // try up to 10 variants (very unlikely to need many)
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .neq("id", selfId)
      .limit(1)
      .maybeSingle();
    if (!error && !data) return candidate;
    suffix++;
    candidate = `${candidate}-${suffix}`;
  }
  // last resort
  return `${candidate}-${Math.random().toString(36).slice(2, 4)}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") || "/";

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

  if (code) {
    // 1) Establish session
    await supabase.auth.exchangeCodeForSession(code);
    // 2) Upsert profile
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (user) {
      const rawName =
        (user.user_metadata?.name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        undefined;

      const rawAvatar =
        (user.user_metadata?.avatar_url as string | undefined) || undefined;

      const email = user.email || undefined;

      // derive username: prefer explicit metadata.username if present, else from email local-part, else from name
      let desiredBase =
        (user.user_metadata?.username as string | undefined) ||
        emailLocalPart(email) ||
        (rawName ? rawName.replace(/\s+/g, ".") : undefined) ||
        `user_${user.id.slice(0, 6)}`;

      // ensure sanitized & unique
      const username = await ensureUniqueUsername(supabase, desiredBase, user.id);

      // upsert profile
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          username,
          display_name: rawName || null,
          full_name: rawName || null,
          email: email || null,
          avatar_url: rawAvatar || null,
        },
        { onConflict: "id" }
      );
    }
  }

  return NextResponse.redirect(new URL(redirect, req.url));
}
