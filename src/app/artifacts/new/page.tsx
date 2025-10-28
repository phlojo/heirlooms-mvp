// src/app/artifacts/new/page.tsx
import Link from "next/link";

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

      <form
        action="/api/ingest"
        method="post"
        encType="multipart/form-data"
        className="space-y-5 rounded-2xl border p-4"
      >
        {/* Keep the collectionId so the API associates this artifact */}
        {collectionId && (
          <input type="hidden" name="collectionId" value={collectionId} />
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            name="text"
            placeholder="Add any notes, context, or a short story…"
            className="w-full rounded-xl border px-3 py-2 min-h-[120px]"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Images</label>
          <input
            type="file"
            name="images"
            accept="image/*"
            multiple
            className="block"
          />
          <p className="text-xs text-gray-500">
            You can select multiple images. They’ll be uploaded and included in the artifact.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Audio (optional)</label>
          <input type="file" name="audio" accept="audio/*" className="block" />
          <p className="text-xs text-gray-500">
            If provided, we’ll transcribe and use it to enrich the summary.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-black text-white px-4 py-2 hover:bg-gray-800"
        >
          Create Artifact
        </button>
      </form>
    </main>
  );
}
