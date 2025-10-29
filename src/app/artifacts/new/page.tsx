// src/app/artifacts/new/page.tsx
import Link from "next/link";
import NewArtifactForm from "./NewArtifactForm";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = "force-dynamic";

export default function NewArtifactPage({ searchParams }: PageProps) {
  const collectionId =
    typeof searchParams?.collectionId === "string"
      ? searchParams.collectionId
      : typeof searchParams?.collection_id === "string"
      ? searchParams.collection_id
      : null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Create Artifact</h1>
        <p className="text-sm text-gray-600">
          Add images, optional audio, and notes. We’ll generate a concise title and summary.
        </p>

        <div className="flex items-center gap-3">
          <Link href="/collections" className="text-sm underline">
            All Collections
          </Link>
          {collectionId && (
            <Link
              href={`/collections/${encodeURIComponent(collectionId)}`}
              className="text-sm underline"
            >
              Back to Collection
            </Link>
          )}
        </div>
      </div>

      <NewArtifactForm initialCollectionId={collectionId} />
    </main>
  );
}
