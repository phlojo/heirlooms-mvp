// src/app/artifacts/new/NewArtifactForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialCollectionId: string | null;
};

export default function NewArtifactForm({ initialCollectionId }: Props) {
  const router = useRouter();

  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recording support
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
    if (e.target.files && e.target.files.length) {
      setImages((prev) => [...prev, ...Array.from(e.target.files!)]);
      e.currentTarget.value = "";
    }
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecStream(stream);
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        setAudioFile(file);
      };
      mr.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => setRecordTime((s) => s + 1), 1000);
    } catch (e: any) {
      setError(e?.message || "Microphone permission denied");
    }
  }

  function stopRec() {
    mediaRecorderRef.current?.stop();
    recStream?.getTracks().forEach((t) => t.stop());
    setRecStream(null);
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const fd = new FormData();
      if (initialCollectionId) {
        // Send multiple aliases so API can resolve uuid-or-slug robustly
        fd.append("collectionId", initialCollectionId);
        fd.append("collection_id", initialCollectionId);
        fd.append("collection", initialCollectionId);
      }
      if (text.trim()) fd.append("text", text.trim());
      images.forEach((img) => fd.append("images", img));
      if (audioFile) fd.append("audio", audioFile);

      const r = await fetch("/api/ingest", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to create artifact");

      const slug = j?.slug as string | undefined;
      const id = j?.id as string | undefined;

      if (slug) router.push(`/artifacts/${encodeURIComponent(slug)}`);
      else if (id) router.push(`/artifacts/${encodeURIComponent(id)}`);
      else if (initialCollectionId)
        router.push(`/collections/${encodeURIComponent(initialCollectionId)}`);
      else router.push("/collections/mine");
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {initialCollectionId ? (
        <>
          <input type="hidden" name="collectionId" value={initialCollectionId} />
          <input type="hidden" name="collection_id" value={initialCollectionId} />
          <input type="hidden" name="collection" value={initialCollectionId} />
          <div className="text-xs text-gray-600">
            Adding to collection: <span className="font-mono">{initialCollectionId}</span>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          className="w-full rounded-lg border p-3"
          rows={5}
          placeholder="Add context, names, dates, provenance..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Images</label>
        <input type="file" accept="image/*" multiple onChange={onImagesChange} />
        {images.length ? (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {images.map((f, i) => (
              <li key={i} className="relative rounded-lg border p-2">
                <div className="text-xs break-all">{f.name}</div>
                <button
                  type="button"
                  className="absolute right-1 top-1 text-xs underline"
                  onClick={() => removeImage(i)}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Audio (optional)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
        />

        {recSupported && (
          <div className="mt-2 flex items-center gap-3">
            {!isRecording ? (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={startRec}
              >
                Record
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={stopRec}
              >
                Stop ({recordTime}s)
              </button>
            )}
            {audioFile ? <span className="text-xs text-gray-600">{audioFile.name}</span> : null}
          </div>
        )}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Artifact"}
        </button>
      </div>
    </form>
  );
}
