import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

import { uploadImageToCloudinary, uploadAudioToCloudinary } from '../../../lib/upload';
import { supabase } from '../../../lib/supabase';

async function structureArtifact(input: { text: string; imageUrls: string[]; transcript?: string }) {
  const prompt = `You are turning notes and (optional) transcript into a concise, elegant catalog entry.

Return strictly this JSON:
{
  "title": string,
  "summary": string,
  "media": [ {"type":"image","src":string,"alt"?:string} ]
}

- Use transcript details when helpful.
- Title human-friendly; summary 1–3 sentences.`;
  const content = [input.text, input.transcript ? `Transcript:\n${input.transcript}` : '']
    .filter(Boolean)
    .join('\n\n');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!resp.ok) throw new Error(`OpenAI error: ${await resp.text()}`);

  const data = await resp.json();
  const json = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');

  const safe = z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    media: z.array(z.object({ type: z.literal('image'), src: z.string().url(), alt: z.string().optional() }))
  }).parse(json);

  return { ...safe, media: [...safe.media, ...input.imageUrls.map(u => ({ type: 'image' as const, src: u }))] };
}

async function transcribeAudio(file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-1');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form
  });
  if (!r.ok) throw new Error(`Whisper error: ${await r.text()}`);
  const j = await r.json();
  return j.text as string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const images = formData.getAll('images') as File[];
    const audio = formData.get('audio') as File | null;
    const text = String(formData.get('text') || '');

    // 1) Upload images
    const uploadedImages: string[] = [];
    for (const f of images.slice(0, 8)) {
      try {
        const url = await uploadImageToCloudinary(f);
        uploadedImages.push(url);
      } catch (e: any) {
        console.error('Image upload failed:', e?.message || e);
      }
    }

    // 2) Upload audio (optional)
    let audioUrl: string | undefined;
    if (audio) {
      try {
        audioUrl = await uploadAudioToCloudinary(audio);
      } catch (e: any) {
        console.error('Audio upload failed:', e?.message || e);
      }
    }

    // 3) Transcribe audio (optional)
    let transcript: string | undefined;
    if (audio) {
      try {
        transcript = await transcribeAudio(audio);
      } catch (e: any) {
        console.warn('Whisper transcription skipped:', e?.message || e);
      }
    }

    // 4) LLM structuring (optional; falls back gracefully)
    let title = text.trim() || 'Untitled Artifact';
    let summary = 'Generated via MVP.';
    let media: { type: 'image' | 'audio'; src: string; alt?: string }[] =
      uploadedImages.map(u => ({ type: 'image', src: u }));

    try {
      const structured = await structureArtifact({ text, imageUrls: uploadedImages, transcript });
      if (structured) {
        title = structured.title ?? title;
        summary = structured.summary ?? summary;
        if (Array.isArray(structured.media) && structured.media.length > 0) {
          media = structured.media as typeof media;
        }
      }
    } catch (llmErr: any) {
      console.warn('LLM structuring skipped/fallback:', llmErr?.message ?? llmErr);
    }

    // 5) If we have audio, add it to media so the page shows a player
    if (audioUrl) {
      media.push({ type: 'audio', src: audioUrl });
    }

    // 6) Slug + save
    const slug =
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) ||
      `artifact-${Math.random().toString(36).slice(2, 8)}`;

    const artifact = {
      id: crypto.randomUUID(),
      title,
      summary,
      media,
      transcript, // ← saved so you can display it
      tags: [],
      theme: 'museum',
      privacy: 'public'
    };

    const { error } = await supabase.from('artifacts').insert({ slug, json: artifact });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ slug }), { status: 200 });
  } catch (err: any) {
    console.error('INGEST ERROR:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
