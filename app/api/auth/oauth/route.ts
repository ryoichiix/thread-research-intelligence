import { NextRequest, NextResponse } from "next/server";
import type { Provider } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "google" && provider !== "github") {
    return NextResponse.redirect(new URL("/login?error=unsupported_provider", request.url));
  }
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.redirect(new URL("/login?error=supabase_not_configured", request.url));
  const callback = new URL("/api/auth/callback", request.url).toString();
  const { data, error } = await client.auth.signInWithOAuth({ provider: provider as Provider, options: { redirectTo: callback } });
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  return NextResponse.redirect(data.url);
}
