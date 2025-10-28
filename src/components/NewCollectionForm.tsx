// src/components/NewCollectionForm.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function NewCollectionForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const coverRef = useRef<HTMLInputElement | null>(null);

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setCoverFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setCoverPreview(url);
    } else {
      setCoverPreview(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setNeedsLogin(false);
    setBusy(true);

    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("is_public", String(isPublic));
      if (coverFile) fd.append("cover", coverFile);

      const r = await fetch("/api/collections/create", {
        method: "POST",
        body: fd,
      });

      if (r.status === 401) {
        setNeedsLogin(true);
        setMsg("Please sign in to create a collection.");
        setBusy(false);
        return;
      }

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to create collection");

      const id = j?.id;
      const slug = j?.slug;
      if (id) router.push(`/collections/${id}`);
      else if (slug) router.push(`/collections/slug/${slug}`);
      else router.push(`/collections`);
    } catch (err: any) {
      setMsg(`❌ ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border p-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="My Family Photos"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short note about this collection…"
          className="w-full rounded-xl border px-3 py-2 min-h-[100px]"
        />
      </div>

      {/* Cover image uploader */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Cover Image (optional)</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="rounded-lg border px-3 py-2 text-sm">
              {coverFile ? "Change cover" : "Upload cover"}
            </span>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onCoverChange}
              disabled={busy}
            />
          </label>
          {coverFile && (
            <span className="text-xs text-gray-500">{coverFile.name}</span>
          )}
        </div>
        {coverPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPreview}
            alt="Cover preview"
            className="mt-2 w-full max-w-sm rounded-xl border"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isPublic"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="isPublic" className="text-sm">
          Make public
        </label>
      </div>

      {msg && <div className="text-sm">{msg}</div>}

      {needsLogin && (
        <div className="text-sm">
          <a
            href={`/login?redirect=${encodeURIComponent("/collections/new")}`}
            className="underline"
          >
            Sign in
          </a>{" "}
          to continue.
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create Collection"}
      </button>
    </form>
  );
}
