import { createClient } from "@/lib/supabase/server";
import { geminiProvider, PROMPT_VERSION, MODEL } from "./gemini";
import { getActiveRelationship } from "@/lib/services/relationships";

export async function generateOrGetSummary(patientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Step 1: permission check, BEFORE any data is touched or sent anywhere.
  const relationship = await getActiveRelationship(patientId, user.id);
  if (!relationship) return { error: "You do not have access to this patient." };

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 30);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = new Date().toISOString().slice(0, 10);

  // Step 2: don't regenerate if a summary for this exact window already
  // exists (cost control -- see architecture doc Section 36).
  const { data: existing } = await supabase
    .from("ai_summaries")
    .select("*")
    .eq("patient_id", patientId)
    .eq("generated_for_psychiatrist_id", user.id)
    .eq("period_start", periodStartStr)
    .eq("period_end", periodEndStr)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (existing) return { summary: existing };

  // Step 3: data selection -- only this patient, only this window, only
  // journal entries the patient explicitly chose to share.
  const [{ data: checkIns }, { data: journalEntries }, { data: discussionItems }, { data: profile }] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select("checkin_date, mood, energy, sleep_hours, medication_taken, note")
        .eq("patient_id", patientId)
        .gte("checkin_date", periodStartStr)
        .order("checkin_date", { ascending: true }),
      supabase
        .from("journal_entries")
        .select("created_at, content")
        .eq("patient_id", patientId)
        .eq("is_shared_with_psychiatrist", true)
        .gte("created_at", periodStart.toISOString()),
      supabase
        .from("discussion_items")
        .select("title, description, status")
        .eq("patient_id", patientId),
      supabase.from("profiles").select("display_name").eq("id", patientId).single(),
    ]);

  try {
    const output = await geminiProvider.generateSummary({
      patientDisplayName: profile?.display_name ?? "Patient",
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      checkIns: (checkIns ?? []).map((c) => ({
        date: c.checkin_date,
        mood: c.mood,
        energy: c.energy,
        sleep_hours: c.sleep_hours,
        medication_taken: c.medication_taken,
        note: c.note,
      })),
      sharedJournalEntries: (journalEntries ?? []).map((j) => ({
        created_at: j.created_at,
        content: j.content,
      })),
      discussionItems: (discussionItems ?? []).map((d) => ({
        title: d.title,
        description: d.description,
        status: d.status,
      })),
    });

    const { data: saved, error: saveError } = await supabase
      .from("ai_summaries")
      .insert({
        patient_id: patientId,
        generated_for_psychiatrist_id: user.id,
        period_start: periodStartStr,
        period_end: periodEndStr,
        model_identifier: MODEL,
        prompt_version: PROMPT_VERSION,
        output,
      })
      .select("*")
      .single();

    if (saveError || !saved) {
      if (saveError?.code === "42501") {
        return {
          error: "Gemini generated the summary, but Supabase blocked saving it. Verify that database/migrations/0003_ai_and_audit_policies.sql has been applied.",
        };
      }
      return { error: "The summary was generated but could not be saved. Please try again." };
    }

    // Audit log: record that a summary was generated -- never its content.
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "ai_summary_generated",
      target_patient_id: patientId,
      metadata: { period_start: periodStartStr, period_end: periodEndStr },
    });

    return { summary: saved };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not generate a summary right now. Please review the raw timeline instead.",
    };
  }
}
