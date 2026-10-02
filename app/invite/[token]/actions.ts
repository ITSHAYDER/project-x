"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/services/relationships";

export async function acceptInviteAction(formData: FormData) {
  const token = String(formData.get("token"));
  const result = await acceptInvite(token);
  if (result.error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/patient/dashboard");
}
