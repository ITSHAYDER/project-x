import { createClient } from "@/lib/supabase/server";
import { journalEntrySchema } from "@/lib/validation/schemas";

export async function createJournalEntry(formData: FormData) {
  const parsed = journalEntrySchema.safeParse({
    title: formData.get("title") || undefined,
    content: formData.get("content"),
    is_shared_with_psychiatrist: formData.get("is_shared_with_psychiatrist") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("journal_entries").insert({
    patient_id: user.id,
    title: parsed.data.title || null,
    content: parsed.data.content,
    is_shared_with_psychiatrist: parsed.data.is_shared_with_psychiatrist ?? false,
  });

  if (error) return { error: "Could not save your entry. Please try again." };
  return { success: true };
}

export async function getOwnJournalEntries(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// Used from the psychiatrist side -- RLS (migration 0001) already
// guarantees this can only ever return entries where
// is_shared_with_psychiatrist = true for an active patient, but the
// explicit .eq() here documents that intent in the code too.
export async function getSharedJournalEntries(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("patient_id", patientId)
    .eq("is_shared_with_psychiatrist", true)
    .order("created_at", { ascending: false });
  return data ?? [];
}
