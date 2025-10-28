"use client";
import { useRef, useState } from "react";

export function CoverUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      // get signed params from our API
      const sigRes = await fetch("/api/cloudinary/sign", { method: "POST" });
      const { timestamp, folder, apiKey, cloudName, signature } = await sigRes.json();

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("folder", folder);
      form.append("signature", signature);

      const upload = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const data = await upload.json();

      if (data.secure_url) {
        onUploaded(data.secure_url);
      }
    } finally {
      setBusy(false);
      // Clear the input safely even if the event is stale
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <span className="rounded-lg border px-3 py-2 text-sm">
        {busy ? "Uploading…" : "Upload cover"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={busy}
      />
    </label>
  );
}
