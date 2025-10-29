// src/app/api/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import {
  uploadImageToCloudinary,
  uploadAudioToCloudinary,
} from "@/src/lib/upload";

export const runtime = "nodejs";

// ---------- Types ----------
type MediaItem = { type: "image" | "audio"; src: string; alt?: string };

// Some projects return a string, some return { secure_url }, some return { url },
// and some nest inside .data. Handle them all safely.
type UnknownUploadResult =
  | string
  | null
  | undefined
  | {
      secure_url?: string;
      url?: string;
      data?: { secure_url?: string; url?: string };
      [k: string]: any;
    };

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- Helpers ----------
function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function extractUrl(result: UnknownUploadResult): string | null {
  if (!result) return null;
  if (typeof result === "string") return result || null;

  // Common Cloudinary SDK shapes
  if (typeof result.secure_url === "string" && result.secure_url) return result.secure_url;
  if (typeof result.url === "string" && result.url) return result.url;

  // Some wrappers put the response under .data
  const data = (result as any).data;
  if (data) {
    if (typeof data.secure_url === "string" && data.secure_url) return data.secure_url;
    if (typeof data.url === "string" && data.url) return data.url;
  }

  // Try a couple of obvious fallbacks if the SDK shape changes
  if (typeof (result as any).secureUrl === "string") return (result as any).secureUrl;
  if (typeof (result as any).href === "string") return (result as any).href;

  return null;
}

// Extract text or query/form fields
function getFieldFrom(fd: FormData | null, qp: URLSearchParams, key: string): string | null {
  const vForm = fd?.get(key);
  if (typeof vForm === "string" && vForm.trim()) return vForm.trim();
  const vQuery = qp.get(key);
  if (typeof vQuery === "string" && vQuery.trim()) return vQuery.trim();
  return null;
}

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ctype = req.headers.get("content-type") || "";
    const isMultipart = ctype.includes("multipart/form-data");
    const formData = isMultipart ? await req.formData() : null;

    const url = new URL(req.url);
    const qp = url.searchParams;

    const text = getFieldFrom(formData, qp, "text") || "";
    const colParam =
      getFieldFrom(formData, qp, "collectionId") ||
      getFieldFrom(formData, qp, "collection_id") ||
      getFieldFrom(formData, qp, "collection");

    // ---- Upload media (robust to different upload return shapes)
    const media: MediaItem[] = [];

    if (isMultipart) {
      // Images
      const imgFiles = formData!.getAll("images").filter((v) => v instanceof File) as File[];
      for (const f of imgFiles) {
        const res = await uploadImageToCloudinary(f);
        const url = extractUrl(res);
        if (url) media.push({ type: "image", src: url });
      }

      // Audio
      const audioFile = formData!.get("audio");
      if (audioFile instanceof File) {
        const res = await uploadAudioToCloudinary(audioFile);
        const url = extractUrl(res);
        if (url) media.push({ type: "audio", src: url });
      }
    }

    // ---- Resolve collection (accept uuid or slug)
    let collectionId: string | null = colParam && uuidRegex.test(colParam) ? colParam : null;

    if (!collectionId && colParam) {
      const { data: found, error: findErr } = await supabase
        .from("collections")
        .select("id")
        .or(`slug.eq.${colParam},id.eq.${colParam}`)
        .limit(1)
        .maybeSingle();
      if (!findErr && found?.id) collectionId = found.id;
    }

    // Hard-require a valid collection to ensure top-level collection_id gets set
    if (!collectionId) {
      return NextResponse.json(
        { error: "A valid collectionId or slug is required." },
        { status: 400 }
      );
    }

    // ---- Build artifact fields
    const title =
      text?.trim()
        ? text.trim().slice(0, 80)
        : media.find((m) => m.type === "image")
        ? "Photograph"
        : "Artifact";

    const summary = text?.trim()
      ? text.trim().slice(0, 160)
      : "Imported via uploader.";

    const imageUrls = media.filter((m) => m.type === "image").map((m) => m.src);

    const dataPayload: Record<string, any> = {
      title,
      summary,
      media,
      tags: [],
      theme: "museum",
      privacy: "public",
      created_at: new Date().toISOString(),
      collection_id: collectionId, // JSON mirror (useful if column write is blocked)
      ...(imageUrls.length ? { image_urls: imageUrls } : {}),
    };

    const slug = toSlug(title);
    const row = {
      slug,
      data: dataPayload,
      title,
      summary,
      owner_id: user.id,
      collection_id: collectionId, // top-level column
    };

    // ---- Insert
    let inserted: any;
    let insertErr: any;

    {
      const { data, error } = await supabase
        .from("artifacts")
        .insert(row)
        .select("id, slug, collection_id")
        .single();
      inserted = data;
      insertErr = error;
    }

    // If column is missing (42703), retry without top-level (JSON still has it)
    if (insertErr?.code === "42703") {
      const { data: data2, error: err2 } = await supabase
        .from("artifacts")
        .insert({
          slug,
          data: dataPayload,
          title,
          summary,
          owner_id: user.id,
        })
        .select("id, slug, collection_id")
        .single();
      inserted = data2;
      insertErr = err2;
    }

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Best-effort patch in case top-level came back null (RLS/column write)
    if (!inserted.collection_id) {
      await supabase.from("artifacts").update({ collection_id: collectionId }).eq("id", inserted.id);
    }

    return NextResponse.json(
      {
        id: inserted.id,
        slug: inserted.slug,
        collection_id: inserted.collection_id ?? collectionId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
