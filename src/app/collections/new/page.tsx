// src/app/collections/new/page.tsx
import { NewCollectionForm } from "@/src/components/NewCollectionForm";

export default function NewCollectionPage() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Collection</h1>
      <NewCollectionForm />
    </main>
  );
}
