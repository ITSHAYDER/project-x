"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDiscussionItem, resolveDiscussionItem } from "@/lib/services/discussionItems";

export async function submitDiscussionItem(formData: FormData) {
  const result = await createDiscussionItem(formData);
  if (result.error) {
    redirect(`/patient/discussions?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/patient/discussions");
  revalidatePath("/patient/dashboard");
  redirect("/patient/discussions");
}

export async function markResolved(formData: FormData) {
  const id = String(formData.get("id"));
  await resolveDiscussionItem(id);
  revalidatePath("/patient/discussions");
  revalidatePath("/patient/dashboard");
}
