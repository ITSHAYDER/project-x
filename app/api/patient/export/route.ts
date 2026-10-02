import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [{ data: profile }, { data: checkIns }, { data: journals }, { data: discussions }, { data: assessments }] = await Promise.all([
    supabase.from("profiles").select("display_name, role, created_at").eq("id", user.id).single(),
    supabase.from("check_ins").select("checkin_date, mood, energy, sleep_hours, medication_taken, note, wants_to_discuss, created_at").eq("patient_id", user.id).order("checkin_date", { ascending: false }),
    supabase.from("journal_entries").select("title, content, is_shared_with_psychiatrist, created_at, updated_at").eq("patient_id", user.id).order("created_at", { ascending: false }),
    supabase.from("discussion_items").select("title, description, status, created_at, resolved_at").eq("patient_id", user.id).order("created_at", { ascending: false }),
    supabase.from("assessments").select("id, status, current_step, started_at, updated_at, completed_at").eq("patient_id", user.id).order("updated_at", { ascending: false }),
  ]);

  const assessmentIds = (assessments ?? []).map((assessment) => assessment.id);
  const { data: responses } = assessmentIds.length
    ? await supabase.from("assessment_responses").select("assessment_id, question_key, response, skipped, created_at").in("assessment_id", assessmentIds)
    : { data: [] };

  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), profile, check_ins: checkIns ?? [], journal_entries: journals ?? [], discussion_items: discussions ?? [], assessments: assessments ?? [], assessment_responses: responses ?? [] }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="project-x-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
