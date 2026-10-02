import { createClient } from "@/lib/supabase/server";
import { discussionItemSchema } from "@/lib/validation/schemas";

export async function createDiscussionItem(formData: FormData) {
  const parsed = discussionItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid item." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("discussion_items").insert({
    patient_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
  });

  if (error) return { error: "Could not save that. Please try again." };
  return { success: true };
}

export async function resolveDiscussionItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("discussion_items")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { error: "Could not update that item." };
  return { success: true };
}

export async function getDiscussionItems(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("discussion_items")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
