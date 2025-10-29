// src/app/collections/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // never serve a stale page
export const revalidate = 0;            // extra belt-and-suspenders

type Collection = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  owner_id: string | null;
  created_at?: string;
};

type ArtifactRow = {
  id: string;
  slug: string | null;
  title?: string | null;   // if you store a top-level title
  summary?: string | null; // if you store a top-level summary
  data?: any | null;       // if you store JSON details here
  created_at?: string;
};

function pickTitle(a: ArtifactRow) {
  return a.title || a.data?.title || "(untitled)";
}
function pickSummary(a: ArtifactRow) {
  return a.summary || a.data?.summary || "";
}
function pickThumb(a: ArtifactRow) {
  const media = Array.isArray(a.data?.media) ? a.data.media : [];
  const firstImg = media.find((m: any) => m?.type === "image");
  return firstImg?.src || null;
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Touch headers to keep this route dynamic in Next 16
  // (reading headers opts the route out of static optimization)
  await headers();

  const { id } = await params;
  const supabase = await getSupabaseServer();

  // 1) Load the collection
  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id, title, description, cover_url, owner_id, created_at")
    .eq("id", id)
    .single();

  if (colErr || !col) notFound();

  // 2) Load artifacts for this collection
  //    Try first: top-level column "collection_id"
  let artifacts: ArtifactRow[] = [];
  let artErr: any = null;

  {
    const { data, error } = await supabase
      .from("artifacts")
      .select("id, slug, title, summary, data, created_at")
      .eq("collection_id", id)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length) {
      artifacts = data as ArtifactRow[];
    } else {
      // Fallback: if collection_id lives inside JSON (data.collection_id)
      const { data: dataJson, error: errorJson } = await supabase
        .from("artifacts")
        .select("id, slug, title, summary, data, created_at")
        .contains("data", { collection_id: id }) // jsonb containment
        .order("created_at", { ascending: false });

      if (!errorJson && Array.isArray(dataJson)) {
        artifacts = dataJson as ArtifactRow[];
      } else {
        artErr = error || errorJson;
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {col.title || "Untitled Collection"}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/collections/all"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            All Collections
          </Link>
          <Link
            href={`/artifacts/new?collectionId=${encodeURIComponent(col.id)}&collection_id=${encodeURIComponent(col.id)}`}
            className="ml-1 underline"
          >
            New Artifact
          </Link>

        </div>
      </div>

      {col.description && (
        <p className="text-sm text-gray-600">{col.description}</p>
      )}

      {/* Cover */}
      {col.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={col.cover_url}
          alt={col.title ?? "Collection cover"}
          className="w-full max-h-72 rounded-2xl border object-cover"
        />
      ) : null}

      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-gray-500">
          ID: <span className="font-mono">{col.id}</span>
        </div>
        {artErr && (
          <div className="text-xs text-amber-700">
            Warning: {String(artErr?.message || artErr)}
          </div>
        )}
      </div>

      {/* Artifacts grid */}
      {artifacts.length === 0 ? (
        <div className="rounded-xl border p-4 text-gray-600">
          No artifacts yet. Create the first one →
          <Link
            href={`/artifacts/new?collectionId=${encodeURIComponent(col.id)}`}
            className="ml-1 underline"
          >
            New Artifact
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => {
            const title = pickTitle(a);
            const summary = pickSummary(a);
            const thumb = pickThumb(a);
            const href = a.slug
              ? `/artifacts/${encodeURIComponent(a.slug)}`
              : `/artifacts/${encodeURIComponent(a.id)}`;

            return (
              <Link
                key={a.id}
                href={href}
                className="block rounded-2xl border p-4 hover:shadow-sm transition"
              >
                <div className="mb-3 h-36 w-full overflow-hidden rounded-xl bg-gray-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <div className="line-clamp-1 font-medium">{title}</div>
                {summary && (
                  <div className="mt-1 line-clamp-2 text-sm text-gray-600">
                    {summary}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
