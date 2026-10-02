"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createJournalEntry } from "@/lib/services/journals";

export async function submitJournalEntry(formData: FormData) {
  const result = await createJournalEntry(formData);
  if (result.error) {
    redirect(`/patient/journal?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/patient/journal");
  revalidatePath("/patient/timeline");
  redirect("/patient/journal");
}
