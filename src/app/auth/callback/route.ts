// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    if (!code) {
      // No code means Google didn't redirect correctly or wrong URL
      console.error("[auth/callback] Missing ?code");
      return NextResponse.redirect(new URL(`${redirect}?auth_error=missing_code`, req.url));
    }

    // 1) Exchange the code for a session (sets the auth cookies)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        new URL(`${redirect}?auth_error=exchange_failed`, req.url)
      );
    }

    // (Optional) You can upsert a profile here; keep it out for now to reduce failure points.

    // 2) Redirect back
    return NextResponse.redirect(new URL(redirect, req.url));
  } catch (e: any) {
    console.error("[auth/callback] unexpected error:", e?.message || e);
    return NextResponse.redirect(new URL(`${redirect}?auth_error=unexpected`, req.url));
  }
}
