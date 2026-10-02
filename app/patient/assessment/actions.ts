"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const RISK_KEYS = new Set(["safety"]);
const QUESTION_KEYS = ["mood", "energy", "sleep", "anxiety", "focus", "relationships", "changes", "safety"];

function assessmentError(message: string): never {
  redirect(`/patient/assessment?error=${encodeURIComponent(message)}`);
}

function isMissingAssessmentSchema(code?: string) {
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
}

export async function saveAssessmentResponse(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  const questionKey = String(formData.get("question_key") ?? "");
  const response = String(formData.get("response") ?? "").trim();
  const step = Number(formData.get("step") ?? 0);
  const skipped = formData.get("skipped") === "true";

  if (
    !assessmentId ||
    !QUESTION_KEYS.includes(questionKey) ||
    !Number.isInteger(step) ||
    step < 0 ||
    step >= QUESTION_KEYS.length ||
    questionKey !== QUESTION_KEYS[step] ||
    (!response && !skipped) ||
    response.length > 4000
  ) {
    assessmentError("Please choose an answer or skip the current question, then try again.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, patient_id")
    .eq("id", assessmentId)
    .eq("patient_id", user.id)
    .maybeSingle();
  if (!assessment) redirect("/patient/assessment?error=Assessment%20not%20found.");

  if (RISK_KEYS.has(questionKey) && /^(yes|yeah|yep|often)\b|\b(intent|immediate danger|about to hurt)\b/i.test(response)) {
    redirect("/patient/assessment/safety");
  }

  const { error } = await supabase.from("assessment_responses").upsert({
    assessment_id: assessmentId,
    patient_id: user.id,
    question_key: questionKey,
    response: response || "Skipped",
    skipped,
  }, { onConflict: "assessment_id,question_key" });

  if (error) {
    assessmentError(isMissingAssessmentSchema(error.code)
      ? "Reflection storage is not set up yet. Ask your project administrator to run database/migrations/0005_assessments.sql in Supabase."
      : "We couldn't save that answer. Please try again.");
  }

  const nextStep = Math.min(step + 1, 8);
  const { error: progressError } = await supabase.from("assessments").update({
    current_step: nextStep,
    status: nextStep >= 8 ? "completed" : "in_progress",
    completed_at: nextStep >= 8 ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", assessmentId).eq("patient_id", user.id);
  if (progressError) assessmentError("Your answer was saved, but progress could not update. Refresh and continue from the saved question.");

  revalidatePath("/patient/assessment");
  revalidatePath("/patient/dashboard");
  redirect(nextStep >= 8 ? "/patient/assessment?completed=1" : "/patient/assessment");
}

export async function startAssessment() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing, error: lookupError } = await supabase
    .from("assessments")
    .select("id")
    .eq("patient_id", user.id)
    .in("status", ["in_progress", "paused"])
    .maybeSingle();

  if (lookupError) {
    assessmentError(isMissingAssessmentSchema(lookupError.code)
      ? "Reflection storage is not set up yet. Ask your project administrator to run database/migrations/0005_assessments.sql in Supabase."
      : "We couldn't open your reflection right now. Please try again.");
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("assessments").insert({ patient_id: user.id });
    if (insertError) {
      assessmentError(isMissingAssessmentSchema(insertError.code)
        ? "Reflection storage is not set up yet. Ask your project administrator to run database/migrations/0005_assessments.sql in Supabase."
        : "We couldn't start your reflection right now. Please try again.");
    }
  }
  revalidatePath("/patient/assessment");
  redirect("/patient/assessment");
}

export async function pauseAssessment(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("assessments").update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", assessmentId).eq("patient_id", user.id);
  if (error) assessmentError("We couldn't pause your reflection. Please try again.");
  redirect("/patient/dashboard");
}
