// src/app/collections/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtifactRow = {
  id: string;
  slug: string | null;
  title?: string | null;
  summary?: string | null;
  data?: any | null;
  created_at?: string;
  collection_id?: string | null;
};

export default async function CollectionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await getSupabaseServer();
  const idOrSlug = params.id;

  // Resolve route param as id or slug
  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id, title, description, cover_url, owner_id, created_at, slug")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .limit(1)
    .maybeSingle();

  if (colErr || !col) notFound();

  const id = col.id;

  // Try top-level column first
  let artifacts: ArtifactRow[] = [];
  const top = await supabase
    .from("artifacts")
    .select("id, slug, title, summary, data, created_at, collection_id")
    .eq("collection_id", id)
    .order("created_at", { ascending: false });

  if (!top.error && Array.isArray(top.data) && top.data.length) {
    artifacts = top.data as ArtifactRow[];
  } else {
    // Fallback: JSON mirror containment
    const json = await supabase
      .from("artifacts")
      .select("id, slug, title, summary, data, created_at, collection_id")
      .contains("data", { collection_id: id })
      .order("created_at", { ascending: false });

    if (!json.error && Array.isArray(json.data)) {
      artifacts = json.data as ArtifactRow[];
    }
  }

  const pickTitle = (a: ArtifactRow) => a.title || a.data?.title || "(untitled)";
  const pickSummary = (a: ArtifactRow) => a.summary || a.data?.summary || "";
  const pickThumb = (a: ArtifactRow) => {
    const media = Array.isArray(a.data?.media) ? a.data.media : [];
    const firstImg = media.find((m: any) => m?.type === "image");
    return firstImg?.src || null;
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{col.title || "(untitled collection)"}</h1>
          {col.description ? (
            <p className="mt-1 text-sm text-gray-600">{col.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/collections/all"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          >
            All Collections
          </Link>
          <Link
            href={`/artifacts/new?collectionId=${encodeURIComponent(
              col.id
            )}&collection_id=${encodeURIComponent(col.id)}&collection=${encodeURIComponent(
              col.slug || col.id
            )}`}
            className="ml-1 underline"
          >
            New Artifact
          </Link>
        </div>
      </div>

      {artifacts.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm">
          No artifacts yet.{" "}
          <Link
            className="underline"
            href={`/artifacts/new?collectionId=${encodeURIComponent(
              col.id
            )}&collection_id=${encodeURIComponent(col.id)}&collection=${encodeURIComponent(
              col.slug || col.id
            )}`}
          >
            Create one
          </Link>
          .
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => {
            const thumb = pickThumb(a);
            const href = a.slug
              ? `/artifacts/${encodeURIComponent(a.slug)}`
              : `/artifacts/${encodeURIComponent(a.id)}`;

            return (
              <Link
                key={a.id}
                href={href}
                className="block rounded-xl border p-3 hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-16 w-16 flex-none rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 flex-none rounded-lg bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{pickTitle(a)}</div>
                    {pickSummary(a) ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                        {pickSummary(a)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </ul>
      )}
    </main>
  );
}
