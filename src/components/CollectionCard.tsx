import Link from "next/link";

export type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  owner_id: string;
  artifacts_count?: number;
};

export function CollectionCard({ c }: { c: CollectionRow }) {
  return (
    <Link href={`/collections/${c.id}`} className="block rounded-2xl border p-5 hover:shadow-md transition">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
          {c.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm text-gray-500">No cover</span>
          )}
        </div>
        <div className="flex-1">
          <div className="font-semibold">{c.title}</div>
          {c.description && <div className="text-sm text-muted-foreground line-clamp-1">{c.description}</div>}
          {typeof c.artifacts_count === "number" && (
            <div className="text-xs text-gray-500 mt-1">{c.artifacts_count} items</div>
          )}
        </div>
      </div>
    </Link>
  );
}