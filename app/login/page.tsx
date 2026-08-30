import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthClient } from "@/components/auth-client";
import { getAuthContext, isOpenAccess } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (isOpenAccess()) redirect("/dashboard");
  const context = await getAuthContext();
  if (context.userId) redirect("/dashboard");
  const params = await searchParams;
  return <AuthClient initialError={params.error} />;
}
