'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function getSupportedMimeType(): { mime: string; ext: string } {
  const candidates = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'm4a' }, // Safari
    { mime: 'audio/mpeg', ext: 'mp3' },
  ];
  for (const c of candidates) {
    // @ts-ignore: older types may not include isTypeSupported
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c.mime)) return c;
  }
  return { mime: '', ext: '' }; // not supported
}

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Recording state
  const [isRecSupported, setIsRecSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeInfo, setMimeInfo] = useState<{ mime: string; ext: string }>({ mime: '', ext: '' });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const info = getSupportedMimeType();
    setMimeInfo(info);
    setIsRecSupported(!!info.mime && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isRecording]);

  const mmss = useMemo(() => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, [seconds]);

  async function startRecording() {
    try {
      setErrMsg(null);
      setAudioBlob(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, mimeInfo.mime ? { mimeType: mimeInfo.mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeInfo.mime || 'audio/webm' });
        setAudioBlob(blob);
        // stop the tracks to release mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = mr;
      setSeconds(0);
      setIsRecording(true);
      mr.start();
    } catch (err: any) {
      setErrMsg(err?.message || String(err));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  function discardRecording() {
    setAudioBlob(null);
    setSeconds(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setUrl(null);

    if (!files || files.length === 0) {
      setErrMsg('Please add at least one image.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      [...files].forEach((f) => form.append('images', f));

      if (audioBlob) {
        const ext = mimeInfo.ext || 'webm';
        const mime = mimeInfo.mime || 'audio/webm';
        const file = new File([audioBlob], `note.${ext}`, { type: mime });
        form.append('audio', file);
      }

      form.append('text', text);

      const res = await fetch('/api/ingest', { method: 'POST', body: form });
      const raw = await res.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Route returned non-JSON: ${raw || '(empty)'}`);
      }
      if (!res.ok) throw new Error(data?.error || 'Server error');
      if (!data?.slug) throw new Error('Server did not return a slug');
      setUrl(`/artifact/${data.slug}`);
    } catch (err: any) {
      setErrMsg(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Heirlooms MVP</h1>
      <p className="text-gray-600">Upload 1–3 images, and optionally record a voice note right here.</p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Images */}
        <div>
          <label className="block text-sm mb-1">Images</label>
          <input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
          <p className="text-xs text-gray-500 mt-1">JPG/PNG/WebP; try 1–3 to start.</p>
        </div>

        {/* Audio recorder */}
        <div className="space-y-2">
          <label className="block text-sm mb-1">Voice note</label>

          {isRecSupported ? (
            <div className="flex items-center gap-3 flex-wrap">
              {!isRecording && (
                <button type="button" onClick={startRecording} className="px-3 py-2 rounded bg-black text-white">
                  Start Recording
                </button>
              )}
              {isRecording && (
                <>
                  <button type="button" onClick={stopRecording} className="px-3 py-2 rounded bg-red-600 text-white">
                    Stop
                  </button>
                  <span className="text-sm tabular-nums">{mmss}</span>
                </>
              )}
              {audioBlob && !isRecording && (
                <>
                  <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                  <button type="button" onClick={discardRecording} className="px-3 py-2 rounded border">
                    Discard
                  </button>
                </>
              )}
            </div>
          ) : (
            // Fallback: classic file picker if MediaRecorder not supported
            <input type="file" accept="audio/*" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAudioBlob(f);
            }} />
          )}

          <p className="text-xs text-gray-500">Tip: Recording requires HTTPS (or localhost) and microphone permission.</p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm mb-1">Notes</label>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What is this? Any specs or story bits?"
          />
        </div>

        <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-60" disabled={loading}>
          {loading ? 'Generating…' : 'Create Artifact'}
        </button>
      </form>

      {errMsg && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded p-3 text-sm">
          <strong>Error:</strong> {errMsg}
        </div>
      )}

      {url && (
        <p className="text-sm">
          Done! → <a className="underline" href={url}>{url}</a>
        </p>
      )}
    </main>
  );
}