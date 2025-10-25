// src/app/api/ingest/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';

// IMPORTANT: Node runtime (Cloudinary/Buffer need Node, not Edge)
export const runtime = 'nodejs';

// Use relative imports to avoid alias issues
import { uploadImageToCloudinary } from '../../../lib/upload';
import { supabase } from '../../../lib/supabase';

// ---- OPTIONAL LLM step (can comment out initially) ----
async function structureArtifact(input: { text: string; imageUrls: string[]; transcript?: string }) {
  const prompt = `You are turning raw notes and images into a concise, elegant catalog entry.

Return strictly this JSON schema:
{
  "title": string,
  "summary": string,
  "media": [ {"type":"image","src":string,"alt"?:string} ]
}
- Write a human, warm title and a 1–3 sentence summary.`;

  const content = [input.text, input.transcript ?? ''].filter(Boolean).join('\n\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error: ${txt}`);
  }

  const data = await resp.json();
  const json = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');

  const safe = z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    media: z.array(z.object({ type: z.literal('image'), src: z.string().url(), alt: z.string().optional() }))
  }).parse(json);

  // Merge any URLs we uploaded locally
  const merged = { ...safe, media: [...safe.media, ...input.imageUrls.map(u => ({ type: 'image', src: u }))] };
  return merged;
}

// ---- OPTIONAL Whisper (audio transcription) ----
async function transcribeAudio(file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Whisper error: ${t}`);
  }
  const j = await r.json();
  return j.text as string;
}

export async function POST(req: NextRequest) {
  try {
    // Quick env sanity (don’t log secrets)
    console.log('Cloudinary cloud:', process.env.CLOUDINARY_CLOUD_NAME || '(missing)');

    const formData = await req.formData();
    const images = formData.getAll('images') as File[];
    const audio = formData.get('audio') as File | null;
    const text = String(formData.get('text') || '');

    console.log('Images received:', images.length);

    // Upload images to Cloudinary
    const uploaded: string[] = [];
    for (const f of images.slice(0, 5)) {
      try {
        const url = await uploadImageToCloudinary(f);
        uploaded.push(url);
      } catch (e: any) {
        console.error('Cloudinary upload failed:', e?.message || e);
      }
    }
    console.log('Uploaded URLs:', uploaded);

    // OPTIONAL transcription
    const transcript = audio ? await transcribeAudio(audio) : undefined;

    // OPTIONAL LLM structuring (can skip initially)
    let title = text.trim() || 'Untitled Artifact';
    let summary = 'Generated via MVP.';
    let media = uploaded.map(u => ({ type: 'image' as const, src: u }));

try {
  const structured = await structureArtifact({ text, imageUrls: uploaded, transcript });

  if (structured) {
    title = structured.title ?? title;
    summary = structured.summary ?? summary;

    if (Array.isArray(structured.media) && structured.media.length > 0) {
      media = structured.media as typeof media; // ✅ ensures types match
    }
  }
} catch (llmErr: any) {
  console.warn(
    'LLM structuring skipped/fallback:',
    llmErr?.message ?? llmErr
  );
}

    // Slugify title
    const slug =
      title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || `artifact-${Math.random().toString(36).slice(2,8)}`;

    // Build and save artifact
    const artifact = {
      id: crypto.randomUUID(),
      title,
      summary,
      media,
      tags: [],
      theme: 'museum',
      privacy: 'public'
    };

    const { error } = await supabase.from('artifacts').insert({ slug, json: artifact });
    if (error) {
      console.error('Supabase insert error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ slug }), { status: 200 });
  } catch (err: any) {
    console.error('INGEST ERROR:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
