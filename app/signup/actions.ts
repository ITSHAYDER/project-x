"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "");
  const role = String(formData.get("role") ?? "");
  const next = formData.get("next") ? String(formData.get("next")) : undefined;

  if (role !== "patient" && role !== "psychiatrist") {
    redirect("/signup?error=Please choose a role");
  }
  if (!email || !password || !displayName) {
    redirect("/signup?error=All fields are required");
  }

  const supabase = await createClient();

  // role/display_name land in auth.users.raw_user_meta_data; the
  // handle_new_user() trigger in migration 0001 copies them into
  // public.profiles the instant the account is created.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, display_name: displayName },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  redirect(`/login?message=Check your email to confirm your account${nextParam}`);
}
