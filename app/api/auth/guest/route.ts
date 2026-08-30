import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: existing } = await client.auth.getUser();
  if (!existing.user) {
    const { error } = await client.auth.signInAnonymously({ options: { data: { display_name: "Guest researcher" } } });
    if (error) return NextResponse.json({ error: "Guest access is not enabled in Supabase", detail: error.message }, { status: 503 });
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
