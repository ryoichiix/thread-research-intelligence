import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  const client = await createSupabaseServerClient();
  if (!code || !client) return NextResponse.redirect(new URL("/login?error=oauth_callback_failed", request.url));
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login?error=oauth_callback_failed" : next, request.url));
}
