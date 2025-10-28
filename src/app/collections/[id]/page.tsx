// src/app/collections/[id]/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { notFound } from "next/navigation";

type ArtifactRow = {
  slug: string;
  data: any;
};

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  // Load collection
  const { data: c, error: cErr } = await supabase
    .from("collections")
    .select("id,title,description,cover_url,is_public")
    .eq("id", id)
    .single();

  if (cErr || !c) notFound();

  // Load artifacts for this collection using JSON containment on 'data'
  const { data: rows, error: aErr } = await supabase
    .from("artifacts")
    .select("slug,data")
    .contains("data", { collection_id: c.id });

  if (aErr) {
    throw new Error(`Failed to load artifacts: ${aErr.message}`);
  }

  const artifacts =
    (rows as ArtifactRow[] | null)?.map((r) => {
      const a = r.data || {};
      const img = Array.isArray(a.media) ? a.media.find((m: any) => m?.type === "image") : null;
      return {
        slug: r.slug,
        title: a.title || "(untitled)",
        summary: a.summary || "",
        image_url: img?.src || null,
      };
    }) ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-6">
          <div className="w-28 h-28 rounded-xl overflow-hidden bg-gray-100">
            {c.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-xs text-gray-400">No cover</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{c.title}</h1>
            {c.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl">{c.description}</p>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {c.is_public ? "Public" : "Private (dev mode shows anyway)"}
            </div>
          </div>
        </div>

        <Link
          href={`/artifacts/new?collectionId=${encodeURIComponent(c.id)}`}
          className="rounded-xl bg-black text-white px-4 py-2 hover:bg-gray-800"
        >
          + New Artifact
        </Link>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {artifacts.map((a) => (
          <Link
            key={a.slug}
            href={`/artifacts/${a.slug}`}
            className="rounded-2xl border p-4 hover:shadow-sm transition"
          >
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.image_url}
                alt={a.title}
                className="w-full h-40 object-cover rounded-xl mb-3"
              />
            )}
            <div className="font-semibold">{a.title}</div>
            {a.summary && (
              <div className="text-sm text-muted-foreground line-clamp-2">{a.summary}</div>
            )}
          </Link>
        ))}
        {!artifacts.length && (
          <div className="text-sm text-gray-500">No artifacts yet.</div>
        )}
      </div>
    </div>
  );
}
