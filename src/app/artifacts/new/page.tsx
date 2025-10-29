// src/app/artifacts/new/page.tsx
import Link from "next/link";
import NewArtifactForm from "./NewArtifactForm";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = "force-dynamic";

export default function NewArtifactPage({ searchParams }: PageProps) {
  const collectionId =
    typeof searchParams?.collectionId === "string" ? searchParams.collectionId : null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Create Artifact</h1>
        <div className="flex gap-2">
          <Link href="/collections" className="text-sm underline">
            Collections
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
