// src/app/collections/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Collection = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  owner_id: string | null;
  is_public?: boolean | null;
  created_at?: string;
};

type ArtifactRow = {
  id: string;
  slug: string | null;
  title?: string | null;
  summary?: string | null;
  data?: any | null;
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
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await getSupabaseServer();

  // 1) Load the collection by ID (NOT slug)
  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id, title, description, cover_url, owner_id, is_public, created_at")
    .eq("id", id)
    .maybeSingle();

  // If RLS blocks or the row doesn't exist, you'll get null -> 404
  if (colErr || !col) {
    // console.warn("collection fetch error", colErr);
    notFound();
  }

  // 2) Load artifacts for this collection (by column)
  const { data: arts, error: artErr } = await supabase
    .from("artifacts")
    .select("id, slug, title, summary, data, created_at")
    .eq("collection_id", id)
    .order("created_at", { ascending: false });

  const artifacts: ArtifactRow[] = Array.isArray(arts) ? arts : [];

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
            href={`/artifacts/new?collectionId=${encodeURIComponent(col.id)}`}
            className="rounded-xl bg-black text-white px-3 py-2 text-sm hover:bg-gray-800"
          >
            + New Artifact
          </Link>
        </div>
      </div>

      {col.description && (
        <p className="text-sm text-gray-600">{col.description}</p>
      )}

      {col.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={col.cover_url}
          alt={col.title ?? "Collection cover"}
          className="w-full max-h-72 rounded-2xl border object-cover"
        />
      ) : null}

      {artErr && (
        <div className="text-xs text-amber-700">
          Warning loading artifacts: {String(artErr.message || artErr)}
        </div>
      )}

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
