'use client';

import { useState } from 'react';

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
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
      [...files].forEach(f => form.append('images', f));
      if (audio) form.append('audio', audio);
      form.append('text', text);

      const res = await fetch('/api/ingest', { method: 'POST', body: form });

      // Read text first so we can surface useful errors
      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        console.error('Route returned non-JSON:', raw);
        setErrMsg(`Server returned non-JSON: ${raw || '(empty response)'}`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        console.error('Route error:', data);
        setErrMsg(data?.error || 'Server error');
        setLoading(false);
        return;
      }

      if (!data?.slug) {
        setErrMsg('Server did not return a slug.');
        setLoading(false);
        return;
      }

      setUrl(`/artifact/${data.slug}`);
    } catch (err: any) {
      console.error(err);
      setErrMsg(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Heirlooms MVP</h1>
      <p className="text-gray-600">
        Upload 1–3 images, optionally an audio note, add a few words, and we’ll generate a page.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setFiles(e.target.files)}
          />
          <p className="text-xs text-gray-500 mt-1">JPG/PNG/WebP; try 1–3 to start.</p>
        </div>

        <div>
          <label className="block text-sm mb-1">Optional voice (audio)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-gray-500 mt-1">You can skip this for now.</p>
        </div>

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
