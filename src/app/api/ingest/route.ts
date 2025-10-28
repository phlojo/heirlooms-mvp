// src/app/api/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Imports (switch to relative if you don't have the "@/src" alias)
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { uploadImageToCloudinary, uploadAudioToCloudinary } from "@/src/lib/upload";

export const runtime = "nodejs";

// ----- Local types -----
type MediaItem = { type: "image" | "audio"; src: string; alt?: string };

// ----- Helpers -----
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

// ----- Route -----
export async function POST(req: NextRequest) {
  try {
    // Auth: require a logged-in user because artifacts.owner_id is NOT NULL
    const supabase = await getSupabaseServer();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to create artifacts." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const text = String(formData.get("text") || "");
    const collectionId = String(formData.get("collectionId") || "").trim() || null;
    const images = formData.getAll("images") as File[];
    const audio = (formData.get("audio") as File) || null;

    // 1) Upload images
    const uploadedImages: string[] = [];
    for (const img of images) {
      const url = await uploadImageToCloudinary(img);
      uploadedImages.push(url);
    }

    // 2) Upload audio (+ transcript)
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

    // 4) Build record payload
    const slug = toSlug(title);
    const dataPayload = {
      id: crypto.randomUUID(),
      title,
      summary,
      media,
      transcript,
      tags: [],
      theme: "museum",
      privacy: "public",
      collection_id: collectionId, // also inside JSON
      owner_id: user.id,           // also inside JSON
      created_at: new Date().toISOString(),
    };

    // 5) Insert with graceful fallbacks if some columns don't exist
    const fullRow: Record<string, any> = {
      slug,
      data: dataPayload,
      title,
      summary,
      owner_id: user.id,
      collection_id: collectionId,
    };

    async function tryInsert(row: Record<string, any>) {
      const { error } = await supabase.from("artifacts").insert(row);
      return error;
    }

    // Attempt 1: All columns
    let err = await tryInsert(fullRow);

    // If a column doesn't exist (42703), strip progressively
    if (err?.code === "42703") {
      const { collection_id, ...noCollection } = fullRow;
      err = await tryInsert(noCollection);
    }
    if (err?.code === "42703") {
      const { title: _t, summary: _s, ...noTitleSummary } = fullRow;
      err = await tryInsert(noTitleSummary);
    }

    // Surface any remaining error (e.g., other NOT NULL constraints)
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err: any) {
    console.error("INGEST ERROR:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
