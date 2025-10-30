// src/app/artifacts/new/page.tsx
import NewArtifactForm from "./NewArtifactForm";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export const dynamic = "force-dynamic";

function firstNonEmpty(searchParams: PageProps["searchParams"], keys: string[]) {
  for (const k of keys) {
    const v = searchParams?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export default function NewArtifactPage({ searchParams }: PageProps) {
  // Accept any of these (uuid or slug): collectionId, collection_id, id, collection
  const initialCollectionId =
    firstNonEmpty(searchParams, ["collectionId", "collection_id", "id", "collection"]) ||
    null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Create Artifact</h1>
        <p className="text-sm text-gray-600">
          Add images, optional audio, and notes. We’ll generate a concise title and summary.
        </p>
      </div>

      <NewArtifactForm initialCollectionId={initialCollectionId} />
    </main>
  );
}
