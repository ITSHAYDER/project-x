"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveTodayCheckIn } from "@/lib/services/checkins";

export async function submitCheckIn(formData: FormData) {
  const result = await saveTodayCheckIn(formData);

  if (result.error) {
    redirect(`/patient/dashboard?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/patient/dashboard");
  revalidatePath("/patient/timeline");
  redirect("/patient/dashboard?saved=1");
}
