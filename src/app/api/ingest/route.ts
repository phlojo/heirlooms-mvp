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
  const fallback = {
    title: input.text?.trim()
      ? input.text.trim().slice(0, 60)
      : (input.transcript?.trim()?.slice(0, 60) || "Untitled Artifact"),
    summary: input.transcript
      ? "Generated from notes and audio transcript."
      : "Generated from notes.",
    media: input.imageUrls.map((u) => ({ type: "image", src: u } as MediaItem)),
  };

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const prompt = `You are turning notes and (optional) transcript into a concise, elegant catalog entry.

Return strictly this JSON:
{
  "title": string,
  "summary": string,
  "media": [ {"type":"image","src":string,"alt"?:string} ]
}

Guidelines:
- Title: 3–7 words, proper case.
- Summary: 1–3 punchy sentences, no fluff.
- Media: reference given image URLs with short alt text.
- If transcript is present, use it to improve summary.

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
    if (!parsed) throw new Error("Invalid JSON from model");

    const Shape = z.object({
      title: z.string().min(1),
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
  } catch (err) {
    console.warn("LLM structuring failed; using fallback:", err);
    return fallback;
  }
}

async function transcribeAudio(file: File) {
  if (!process.env.OPENAI_API_KEY) return undefined;
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("model", process.env.OPENAI_WHISPER_MODEL || "whisper-1");
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
        { error: "Unauthorized. Please sign in to create artifacts." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const text = String(formData.get("text") || "");
    const colParam =
      String(formData.get("collectionId") || formData.get("collection_id") || "")
        .trim() || null;

    // Debug logging to help trace incoming values during development
    console.log("INGEST: received colParam:", colParam);

    // Only accept valid UUIDs for the top-level column by default. If the client
    // supplied a slug (or other string), try to resolve it to a UUID below.
    let collectionId: string | null = colParam && uuidRegex.test(colParam) ? colParam : null;
    let ingestWarning: string | null = null;

    // If we got a non-UUID colParam, attempt to resolve it as a collection slug.
    if (!collectionId && colParam) {
      try {
        const { data: found, error: findErr } = await supabase
          .from("collections")
          .select("id")
          .eq("slug", colParam)
          .limit(1);

        if (!findErr && Array.isArray(found) && found.length > 0) {
          // found[0] shape: { id: string }
          collectionId = (found[0] as any).id;
          console.log("INGEST: resolved slug to collectionId:", collectionId);
        } else {
          ingestWarning = `collectionId provided but not a UUID and no collection found for slug '${colParam}'`;
          console.log("INGEST: could not resolve collection slug:", colParam, "error:", findErr);
        }
      } catch (err) {
        console.warn("INGEST: slug->id resolution failed:", err);
      }
    }

    const images = formData.getAll("images") as File[];
    const audio = (formData.get("audio") as File) || null;

    // 1) Upload images
    const uploadedImages: string[] = [];
    for (const img of images) {
      const url = await uploadImageToCloudinary(img);
      uploadedImages.push(url);
    }

    // 2) Upload audio / transcript
    let audioUrl: string | null = null;
    let transcript: string | undefined;
    if (audio) {
      audioUrl = await uploadAudioToCloudinary(audio);
      transcript = await transcribeAudio(audio);
    }

    // 3) Structure
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

    const dataPayload = {
      title,
      summary,
      media,
      transcript,
      tags: [],
      theme: "museum",
      privacy: "public",
      collection_id: colParam, // keep original (even if not UUID) in JSON for completeness
      owner_id: user.id,
      created_at: new Date().toISOString(),
    };

    // Try insert with top-level collection_id (when valid)
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

    // If column is missing (42703), retry without it. (Shouldn't happen now that you have the column.)
    if (insertErr?.code === "42703" && collectionId) {
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
      // Ensure the inserted object always includes collection_id to match the expected shape.
      inserted = { ...inserted2!, collection_id: null };
      insertErr = null;
    }

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // If we expected to set a top-level collection_id but the inserted row
    // doesn't include it, attempt a follow-up update. This can help when the
    // DB ignored the field during insert (e.g., column wasn't present at insert
    // time) but is available now. If update fails, we still return the insert
    // result but include a warning.
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
          console.warn("INGEST: failed to patch collection_id:", updErr);
          ingestWarning = ingestWarning || `inserted but failed to patch collection_id: ${String(updErr?.message || updErr)}`;
        }
      } catch (err) {
        console.warn("INGEST: patch attempt failed:", err);
        ingestWarning = ingestWarning || `inserted but patch attempt failed: ${String(err)}`;
      }
    }

    // Return helpful debug/warning fields so the client can surface them during testing.
    const respBody: Record<string, any> = {
      id: inserted!.id,
      slug: inserted!.slug,
      collection_id: finalCollectionId ?? collectionId ?? null,
    };
    if (ingestWarning) respBody.warning = ingestWarning;
    // include original param for debugging
    respBody.received_collection_param = colParam;

    return NextResponse.json(respBody, { status: 200 });
  } catch (err: any) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
