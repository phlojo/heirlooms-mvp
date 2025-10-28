import { getSupabaseServer } from "@/lib/supabase/server";

export async function getUserOrNull() {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function requireUser() {
  const user = await getUserOrNull();
  if (!user) throw new Error("Not authenticated");
  return user;
}