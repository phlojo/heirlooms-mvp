// src/app/api/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { uploadImageToCloudinary, uploadAudioToCloudinary } from "@/src/lib/upload";

export const runtime = "nodejs";

type MediaItem = { type: "image" | "audio"; src: string; alt?: string };

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function structureArtifact(input: {
  text: string;
  imageUrls: string[];
  transcript?: string;
}) {
  const prompt = `
You are an assistant that structures "artifact" content for a family-archive app.
Return ONLY JSON with this shape:

{
  "title": "string (<=80 chars)",
  "summary": "string (1-2 short sentences)",
  "media": [{"type":"image","src":"<url>","alt":"optional"}...]
}

Rules:
- Keep the title succinct and human.
- Include each provided image URL exactly once in "media" with type "image".
- Do not invent media that wasn't provided.
- Do not include backticks.

NOTES:
${input.text || "(none)"}

TRANSCRIPT:
${input.transcript || "(none)"}

IMAGE_URLS:
${input.imageUrls.join("\n")}
`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON. Do not include backticks." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content;
  if (!txt || typeof txt !== "string") throw new Error("No JSON returned");

  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch {
    const match = txt.match(/\{[\s\S]*\}$/);
    parsed = match ? JSON.parse(match[0]) : null;
  }

  const Shape = z.object({
    title: z.string().min(1).max(120),
    summary: z.string().min(1),
    media: z.array(
      z.object({
        type: z.literal("image"),
        src: z.string().url(),
        alt: z.string().optional(),
      })
    ),
  });

  const safe = Shape.parse(parsed);

  // Ensure all supplied images appear at least once
  const existing = new Set(safe.media.map((m) => m.src));
  const additions = input.imageUrls
    .filter((u) => !existing.has(u))
    .map((u) => ({ type: "image" as const, src: u }));

  return { ...safe, media: [...safe.media, ...additions] };
}

async function transcribeAudio(file: File): Promise<string | undefined> {
  try {
    const form = new FormData();
    form.append("model", "whisper-1");
    form.append("file", file as any);
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    return j.text as string;
  } catch (err) {
    console.warn("Whisper transcription failed (non-fatal):", err);
    return undefined;
  }
}

function toSlug(s: string) {
  const base =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `artifact-${Math.random().toString(36).slice(2, 8)}`;
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: authData, error: userErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Accept data from form-data, JSON, or query
    const contentType = req.headers.get("content-type") || "";
    let formData: FormData | null = null;
    let jsonBody: any = null;

    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
    } else if (contentType.includes("application/json")) {
      jsonBody = await req.json().catch(() => null);
    }

    const url = new URL(req.url);

    // Normalize inputs
    const getNorm = (k: string): string | null => {
      const vForm = formData?.get(k);
      if (typeof vForm === "string" && vForm.trim()) return vForm.trim();
      const vJson = jsonBody?.[k];
      if (typeof vJson === "string" && vJson.trim()) return vJson.trim();
      const vQuery = url.searchParams.get(k);
      if (typeof vQuery === "string" && vQuery.trim()) return vQuery.trim();
      return null;
    };

    const text = getNorm("text") || "";
    const colParam =
      getNorm("collectionId") ||
      getNorm("collection_id") ||
      getNorm("collection") ||
      null;

    console.log("INGEST: received colParam:", colParam);

    // Accept only UUIDs directly; if not UUID, attempt slug → id resolution
    let collectionId: string | null = colParam && uuidRegex.test(colParam) ? colParam : null;
    let ingestWarning: string | null = null;

    if (!collectionId && colParam) {
      try {
        const { data: found, error: findErr } = await supabase
          .from("collections")
          .select("id")
          .eq("slug", colParam)
          .limit(1);

        if (!findErr && Array.isArray(found) && found.length > 0) {
          collectionId = (found[0] as any).id as string;
          console.log("INGEST: resolved slug to collectionId:", collectionId);
        } else {
          ingestWarning = `collectionId provided but not a UUID and no collection found for slug '${colParam}'`;
          console.log("INGEST: could not resolve collection slug:", colParam, "error:", findErr);
        }
      } catch (err) {
        console.warn("INGEST: slug->id resolution failed:", err);
      }
    }

    // Files
    const images: File[] = formData ? (formData.getAll("images") as File[]) : [];
    const audio: File | null = formData ? ((formData.get("audio") as File) || null) : null;

    // Upload images
    const uploadedImages: string[] = [];
    for (const img of images) {
      const url = await uploadImageToCloudinary(img);
      uploadedImages.push(url);
    }

    // Upload audio + transcribe if present
    let audioUrl: string | undefined;
    let transcript: string | undefined;
    if (audio) {
      audioUrl = await uploadAudioToCloudinary(audio);
      transcript = await transcribeAudio(audio);
    }

    // Structure with LLM
    const structured = await structureArtifact({
      text,
      imageUrls: uploadedImages,
      transcript,
    });

    const title = structured.title || "Untitled Artifact";
    const summary = structured.summary || "Generated by MVP.";
    const media: MediaItem[] = [
      ...structured.media,
      ...(audioUrl ? [{ type: "audio" as const, src: audioUrl }] : []),
    ];
    const slug = toSlug(title);

    // IMPORTANT: mirror collection both at top-level and inside JSON
    const dataPayload = {
      title,
      summary,
      media,
      transcript,
      tags: [],
      theme: "museum",
      privacy: "public",
      created_at: new Date().toISOString(),
      ...(collectionId ? { collection_id: collectionId } : {}),
    };

    // Try insert with top-level collection_id too
    const baseRow: Record<string, any> = {
      slug,
      data: dataPayload,
      title,
      summary,
      owner_id: user.id,
      ...(collectionId ? { collection_id: collectionId } : {}),
    };

    let { data: inserted, error: insertErr } = await supabase
      .from("artifacts")
      .insert(baseRow)
      .select("id, slug, collection_id")
      .single();

    // If column missing (42703), retry without top-level and rely on JSON mirror
    if (insertErr?.code === "42703") {
      const { data: inserted2, error: insertErr2 } = await supabase
        .from("artifacts")
        .insert({
          slug,
          data: dataPayload,
          title,
          summary,
          owner_id: user.id,
        })
        .select("id, slug")
        .single();

      if (insertErr2) {
        return NextResponse.json({ error: insertErr2.message }, { status: 500 });
      }
      // Ensure shape for the rest of the handler
      inserted = { ...inserted2!, collection_id: null } as any;
      insertErr = null;
    }

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // If insert returned without collection_id but we resolved one, patch it
    let finalCollectionId = inserted!.collection_id ?? null;
    if (collectionId && !finalCollectionId) {
      try {
        const { data: updated, error: updErr } = await supabase
          .from("artifacts")
          .update({ collection_id: collectionId })
          .eq("id", inserted!.id)
          .select("collection_id")
          .single();

        if (!updErr && updated) {
          finalCollectionId = updated.collection_id ?? finalCollectionId;
          console.log("INGEST: patched artifact with collection_id:", finalCollectionId);
        } else {
          console.warn("INGEST: failed to patch collection_id; error:", updErr);
          ingestWarning = ingestWarning || `inserted but failed to patch collection_id: ${updErr?.message || updErr}`;
        }
      } catch (err) {
        console.warn("INGEST: exception patching collection_id:", err);
        ingestWarning = ingestWarning || `inserted but failed to patch collection_id (exception).`;
      }
    }

    const respBody: Record<string, any> = {
      id: inserted!.id,
      slug: inserted!.slug,
      collection_id: finalCollectionId ?? collectionId ?? null,
      received_collection_param: colParam,
    };
    if (ingestWarning) respBody.warning = ingestWarning;

    return NextResponse.json(respBody, { status: 200 });
  } catch (err: any) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
