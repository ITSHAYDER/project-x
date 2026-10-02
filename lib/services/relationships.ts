import { createClient } from "@/lib/supabase/server";

export async function createInvite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // patient_id is left NULL -- nobody has claimed this invite yet.
  // Migration 0002's RLS policies are what make this safe: only the
  // inviting psychiatrist can create it, and only an authenticated user
  // who has the resulting token can view or claim it.
  const { data, error } = await supabase
    .from("patient_psychiatrist_relationships")
    .insert({ psychiatrist_id: user.id, status: "invited" })
    .select("invite_token")
    .single();

  if (error || !data) return { error: "Could not create an invite link." };
  return { token: data.invite_token as string };
}

export async function getInviteByToken(token: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_psychiatrist_relationships")
    .select("id, status, patient_id, psychiatrist_id, profiles!psychiatrist_id(display_name)")
    .eq("invite_token", token)
    .maybeSingle();
  return data;
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("patient_psychiatrist_relationships")
    .update({
      patient_id: user.id,
      status: "active",
      accepted_at: new Date().toISOString(),
    })
    .eq("invite_token", token)
    .is("patient_id", null); // guards against a double-accept race

  if (error) return { error: "Could not accept this invite. It may already be used." };
  return { success: true };
}

export async function getActivePatients(psychiatristId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_psychiatrist_relationships")
    .select("patient_id, accepted_at, profiles!patient_id(display_name)")
    .eq("psychiatrist_id", psychiatristId)
    .eq("status", "active")
    .order("accepted_at", { ascending: false });
  return data ?? [];
}

export async function getActiveRelationship(patientId: string, psychiatristId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_psychiatrist_relationships")
    .select("id")
    .eq("patient_id", patientId)
    .eq("psychiatrist_id", psychiatristId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}
