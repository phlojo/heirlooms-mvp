// src/app/auth/me/page.tsx
import { getSupabaseServer } from "@/src/lib/supabase/server";
import ClientSession from "./ClientSession";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Auth Debug</h1>

      <section>
        <div className="text-sm font-medium mb-1">Server user</div>
        <pre className="p-3 rounded-xl border overflow-auto text-xs">
          {JSON.stringify({ server_user: data?.user ?? null, error }, null, 2)}
        </pre>
      </section>

      <section>
        <div className="text-sm font-medium mb-1">Client session</div>
        <ClientSession />
      </section>
    </div>
  );
}
