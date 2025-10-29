// src/app/artifacts/new/NewArtifactForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialCollectionId: string | null;
};

export default function NewArtifactForm({ initialCollectionId }: Props) {
  const router = useRouter();

  // form state
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // recorder state
  const [recSupported, setRecSupported] = useState(false);
  const [recStream, setRecStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ui state
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // detect recording support
  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    setRecSupported(ok);
  }, []);

  function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImages(files);
  }

  function onAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAudioFile(file);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecStream(stream);

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        // build a File from the chunks
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setAudioFile(file);
        // cleanup stream
        stream.getTracks().forEach((t) => t.stop());
        setRecStream(null);
      };
      mediaRecorderRef.current = mr;
      mr.start();

      // simple timer
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordTime((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setMsg(`Microphone error: ${err?.message || String(err)}`);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const fd = new FormData();
      if (initialCollectionId) fd.append("collectionId", initialCollectionId);
      if (text.trim()) fd.append("text", text.trim());
      images.forEach((img) => fd.append("images", img));
      if (audioFile) fd.append("audio", audioFile);

      // IMPORTANT: client-side fetch so we can redirect ourselves
      const r = await fetch("/api/ingest", {
        method: "POST",
        body: fd,
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || "Failed to create artifact");
      }

      // Expecting { slug, id, collection_id? }
      const slug = j?.slug as string | undefined;
      const id = j?.id as string | undefined;

      // Prefer your canonical route; adjust if your app uses /artifacts/:slug instead.
      if (slug) router.push(`/artifacts/${encodeURIComponent(slug)}`);
      else if (id) router.push(`/artifacts/${encodeURIComponent(id)}`);
      else router.push("/collections");
    } catch (err: any) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function prettyTime(s: number) {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border p-4">
      {initialCollectionId && (
        <div className="text-xs text-gray-600">
          Adding to collection: <span className="font-mono">{initialCollectionId}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add any notes, context, or a short story…"
          className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Images</label>
        <input type="file" name="images" accept="image/*" multiple onChange={onImagesChange} />
        <p className="text-xs text-gray-500">You can select multiple images.</p>
      </div>

      {/* AUDIO: record OR upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Audio (optional)</label>

        {/* Recorder */}
        <div className="rounded-xl border p-3">
          {recSupported ? (
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="rounded-lg bg-black text-white px-3 py-1.5 disabled:opacity-50"
                >
                  ⏺️ Record
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-red-600 text-white px-3 py-1.5"
                >
                  ⏹ Stop ({prettyTime(recordTime)})
                </button>
              )}
              {audioFile && (
                <span className="text-xs text-gray-600">Recorded: {audioFile.name}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              Recording not supported in this browser. You can upload an audio file instead.
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500">or upload:</div>
        <input type="file" name="audio" accept="audio/*" onChange={onAudioUpload} />
        {audioFile && (
          <audio className="mt-2 w-full" controls src={URL.createObjectURL(audioFile)} />
        )}
      </div>

      {msg && <div className="text-sm">{msg}</div>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create Artifact"}
      </button>
    </form>
  );
}
