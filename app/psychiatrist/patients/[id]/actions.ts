"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateOrGetSummary } from "@/lib/ai/summarize";

export async function generateSummaryAction(formData: FormData) {
  const patientId = String(formData.get("patient_id"));
  const result = await generateOrGetSummary(patientId);

  if (result.error) {
    redirect(
      `/psychiatrist/patients/${patientId}?error=${encodeURIComponent(result.error)}`
    );
  }

  revalidatePath(`/psychiatrist/patients/${patientId}`);
}
