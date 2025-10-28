// src/components/AudioRecorder.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function AudioRecorder({
  onAudioReady,
  disabled,
}: {
  onAudioReady: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  async function start() {
    if (disabled || !supported) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setMediaStream(stream);
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mrRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      onAudioReady(blob);
      chunksRef.current = [];
      stream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    };

    mr.start();
    setRecording(true);
  }

  function stop() {
    mrRef.current?.stop();
    setRecording(false);
  }

  if (!supported) {
    return <div className="text-xs text-gray-500">Audio recording not supported on this device/browser.</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          🎙️ Start Recording
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="rounded-xl bg-red-600 text-white px-3 py-2 text-sm hover:bg-red-700"
        >
          ⏹ Stop
        </button>
      )}
    </div>
  );
}
