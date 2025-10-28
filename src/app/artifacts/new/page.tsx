// src/app/artifacts/new/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AudioRecorder } from "@/src/components/AudioRecorder";

export default function NewArtifactPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const collectionId = qs.get("collectionId") ?? "";

  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const imagesInputRef = useRef<HTMLInputElement | null>(null);

  function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setImages(files);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const fd = new FormData();
      fd.append("text", text);
      if (collectionId) fd.append("collectionId", collectionId);
      images.forEach((f) => fd.append("images", f));
      if (audioFile) fd.append("audio", audioFile);

      const r = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to create artifact");

      // Go to the new artifact page
      router.push(`/artifacts/${j.slug}`);
    } catch (err: any) {
      setMsg(`❌ ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Create Artifact</h1>
        <div className="flex gap-2">
          {collectionId && (
            <Link
              href={`/collections/${encodeURIComponent(collectionId)}`}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              ← Back to Collection
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border p-4">
        {/* Notes / Prompt text */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Notes / Description</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a few notes about this artifact. The AI will create a title & summary."
            className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
          />
        </div>

        {/* Images */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Images</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="rounded-lg border px-3 py-2 text-sm">{images.length ? "Change images" : "Upload images"}</span>
              <input
                ref={imagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onImagesChange}
                disabled={busy}
              />
            </label>
            {!!images.length && <span className="text-xs text-gray-500">{images.length} selected</span>}
          </div>
        </div>

        {/* Audio: record or upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Audio (optional)</label>
          <AudioRecorder
            disabled={busy}
            onAudioReady={(blob) => {
              const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
              setAudioFile(file);
              setMsg("Audio captured (you can replace it by recording again or uploading a file).");
            }}
          />
          <div className="text-xs text-gray-500">Or upload an audio file instead:</div>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          {audioFile && <div className="text-xs text-gray-600">Selected: {audioFile.name}</div>}
        </div>

        {msg && <div className="text-sm text-gray-700">{msg}</div>}

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-xl bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Creating…" : "Create Artifact"}
          </button>

          {collectionId && (
            <input type="hidden" name="collectionId" value={collectionId} />
          )}
        </div>
      </form>
    </main>
  );
}
