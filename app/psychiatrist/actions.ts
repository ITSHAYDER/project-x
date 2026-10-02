"use server";

import { redirect } from "next/navigation";
import { createInvite } from "@/lib/services/relationships";

export async function createInviteAction() {
  const result = await createInvite();
  if (result.error) {
    redirect(`/psychiatrist/dashboard?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/psychiatrist/dashboard?invite_token=${result.token}`);
}
