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

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // recorder support
  const [recSupported, setRecSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recStream, setRecStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setRecSupported(typeof window !== "undefined" && "MediaRecorder" in window);
  }, []);

  function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setAudioFile(file);
        stream.getTracks().forEach((t) => t.stop());
        setRecStream(null);
      };
      mediaRecorderRef.current = mr;
      mr.start();

      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000) as unknown as number;
    } catch (err: any) {
      console.warn("Recorder failed:", err);
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } finally {
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const fd = new FormData();
      if (initialCollectionId) {
        // send a couple of key names for robustness
        fd.append("collectionId", initialCollectionId);
        fd.append("collection_id", initialCollectionId);
      }
      if (text.trim()) fd.append("text", text.trim());
      images.forEach((img) => fd.append("images", img));
      if (audioFile) fd.append("audio", audioFile);

      const r = await fetch("/api/ingest", {
        method: "POST",
        body: fd,
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || "Failed to create artifact");
      }

      const slug = j?.slug as string | undefined;
      const id = j?.id as string | undefined;

      if (slug) router.push(`/artifacts/${encodeURIComponent(slug)}`);
      else if (id) router.push(`/artifacts/${encodeURIComponent(id)}`);
      else router.push("/collections");
    } catch (err: any) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {initialCollectionId && (
        <>
          <input type="hidden" name="collectionId" value={initialCollectionId} />
          <input type="hidden" name="collection_id" value={initialCollectionId} />
          <div className="text-xs text-gray-600">
            Adding to collection: <span className="font-mono">{initialCollectionId}</span>
          </div>
        </>
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

      <div className="space-y-2">
        <label className="block text-sm font-medium">Audio (optional)</label>

        <div className="rounded-xl border p-3">
          {recSupported ? (
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="rounded-lg border px-3 py-1.5"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg border px-3 py-1.5"
                >
                  Stop ({recordTime}s)
                </button>
              )}
              {audioFile && <div className="text-xs">Recorded: {audioFile.name}</div>}
            </div>
          ) : (
            <div className="text-xs text-gray-600">Recording not supported in this browser.</div>
          )}
        </div>

        <div>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          />
          {audioFile && <div className="text-xs mt-1">{audioFile.name}</div>}
        </div>
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
