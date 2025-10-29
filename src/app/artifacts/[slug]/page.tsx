// src/app/artifacts/[slug]/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { notFound } from "next/navigation";

// Next 16 server component: params is a Promise
export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServer();

  const { data: row, error } = await supabase
    .from("artifacts")
    .select("slug,data")
    .eq("slug", slug)
    .single();

  if (error || !row) notFound();

  const a = row.data || {};
  const title = a.title || "(untitled)";
  const summary = a.summary || "";
  const media = Array.isArray(a.media) ? a.media : [];
  const collectionId = a.collection_id || null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>

        <div className="flex gap-2">
          {collectionId && (
            <Link
              href={`/collections/${encodeURIComponent(collectionId)}`}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              ← Back to Collection
            </Link>
          )}
          <Link
            href={`/artifacts/new${collectionId ? `?collectionId=${encodeURIComponent(collectionId)}` : ""}`}
            className="rounded-xl bg-black text-white px-3 py-2 text-sm hover:bg-gray-800"
          >
            + New Artifact
          </Link>
        </div>
      </div>

      {summary && <p className="text-muted-foreground">{summary}</p>}

      <div className="space-y-4">
        {media.map((m: any, i: number) =>
          m?.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={m.src}
              alt={m.alt || title}
              className="w-full rounded-2xl border"
            />
          ) : m?.type === "audio" ? (
            <audio key={i} controls className="w-full">
              <source src={m.src} />
            </audio>
          ) : null
        )}
      </div>

      {a.transcript && (
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold mb-2">Transcript</div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{a.transcript}</pre>
        </div>
      )}
    </div>
  );
}
