import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingClient } from "@/components/onboarding-client";
import { getAuthContext } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Start research" };

export default async function OnboardingPage() {
  const context = await getAuthContext();
  if (!context.userId) redirect("/login");
  return <OnboardingClient />;
}
