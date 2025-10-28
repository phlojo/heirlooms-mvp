// src/app/collections/mine/page.tsx
import { getSupabaseServer } from "@/src/lib/supabase/server";
import { Page } from "@/src/components/Ui";
import { CollectionCard, type CollectionRow } from "@/src/components/CollectionCard";

export default async function MyCollectionsPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <Page title="My Collections">Please sign in.</Page>;

  const { data, error } = await supabase
    .from("collections")
    .select("id,title,description,cover_url,is_public,owner_id")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (
    <Page title="My Collections">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data!.map((c: CollectionRow) => (
          <CollectionCard key={c.id} c={c} />
        ))}
      </div>
    </Page>
  );
}
