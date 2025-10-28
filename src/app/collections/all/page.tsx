// src/app/collections/all/page.tsx
import Link from "next/link";
import { getSupabaseServer } from "@/src/lib/supabase/server";

type Collection = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  owner_id: string | null;
  created_at?: string;
  is_public?: boolean;
};

type Profile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  username_legacy?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

function shortOwner(id?: string | null) {
  if (!id) return "Unknown";
  return id.length > 8 ? id.slice(0, 8) : id;
}
function emailLocalPart(email?: string | null) {
  if (!email) return null;
  const local = email.split("@")[0] || "";
  return local.replace(/\+.*/, "");
}
function pickDisplayName(p?: Profile | null) {
  if (!p) return null;
  return (
    p.username ||
    p.display_name ||
    p.full_name ||
    p.name ||
    emailLocalPart(p.email) ||
    null
  );
}

export const dynamic = "force-dynamic";

export default async function AllCollectionsPage() {
  const supabase = await getSupabaseServer();

  // 1) Load all collections
  const { data: collections, error } = await supabase
    .from("collections")
    .select("id, title, description, cover_url, owner_id, created_at, is_public")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Failed to load collections: {error.message}
      </div>
    );
  }

  const list = (collections as Collection[] | null) ?? [];

  // 2) Unique owner IDs
  const ownerIds = Array.from(
    new Set(
      list
        .map((c) => c.owner_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  // 3) Resolve profiles
  const profilesById = new Map<string, Profile>();
  if (ownerIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, full_name, email, avatar_url")
      .in("id", ownerIds);

    if (Array.isArray(profs)) {
      for (const p of profs as Profile[]) {
        profilesById.set(p.id, p);
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Collections</h1>
        <Link
          href="/collections/new"
          className="rounded-xl bg-black text-white px-4 py-2 hover:bg-gray-800"
        >
          + New Collection
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="text-gray-500">No collections yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const prof = c.owner_id ? profilesById.get(c.owner_id) ?? null : null;
            const author =
              pickDisplayName(prof) ??
              (c.owner_id ? `User ${shortOwner(c.owner_id)}` : "Unknown");

            return (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="block rounded-2xl border p-4 hover:shadow-sm transition"
              >
                <div className="w-full h-40 rounded-xl overflow-hidden bg-gray-100 mb-3">
                  {c.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.cover_url}
                      alt={c.title ?? "Collection cover"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-gray-400">
                      No cover
                    </div>
                  )}
                </div>

                <div className="font-semibold line-clamp-1">
                  {c.title || "Untitled Collection"}
                </div>

                {c.description && (
                  <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {c.description}
                  </div>
                )}

                {/* Author line */}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {prof?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={prof.avatar_url}
                      alt={author}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  ) : null}
                  <span>by {author}</span>
                </div>

                {c.is_public === false && (
                  <div className="mt-1 text-[11px] text-amber-600">Private</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
