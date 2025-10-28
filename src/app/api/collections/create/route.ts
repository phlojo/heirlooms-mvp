// src/app/api/collections/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { uploadImageToCloudinary } from "@/src/lib/upload";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  is_public: z.coerce.boolean().optional(),
  slug: z.string().optional(),
});

function toSlug(s: string) {
  const base =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `collection-${Math.random().toString(36).slice(2, 8)}`;
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to create a collection." },
        { status: 401 }
      );
    }

    // We accept multipart/form-data so we can handle cover image upload
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const form = await req.formData();

    // Parse text fields
    const parsed = BodySchema.safeParse({
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      is_public: String(form.get("is_public") || "false"),
      slug: String(form.get("slug") || ""),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, description, is_public = false } = parsed.data;
    const desiredSlug = parsed.data.slug?.trim();
    const slug = desiredSlug || toSlug(title);

    // Optional cover image
    const cover = form.get("cover") as File | null;
    let cover_url: string | null = null;
    if (cover && cover.size > 0) {
      cover_url = await uploadImageToCloudinary(cover);
    }

    // Try insert with all columns; fallback if some don’t exist
    async function tryInsert(row: Record<string, any>) {
      const { data, error } = await supabase
        .from("collections")
        .insert(row)
        .select("id, slug")
        .single();
      return { data, error };
    }

    const fullRow = {
      title,
      description: description || null,
      is_public,
      owner_id: user.id,
      cover_url,
      slug,
    };

    let { data, error } = await tryInsert(fullRow);

    if (error?.code === "42703") {
      // Some columns don’t exist (e.g. slug or cover_url) → progressively strip
      const { slug: _s, cover_url: _c, ...withoutSlugCover } = fullRow;
      ({ data, error } = await tryInsert(withoutSlugCover));
      if (error?.code === "42703") {
        // strip is_public if needed
        const { is_public: _p, ...minimal } = withoutSlugCover;
        ({ data, error } = await tryInsert(minimal));
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { id: data?.id, slug: data?.slug ?? slug },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("CREATE COLLECTION ERROR:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
