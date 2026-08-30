import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isGuestMode() {
  return process.env.GUEST_MODE === "true";
}

export function isOpenAccess() {
  return process.env.OPEN_ACCESS === "true";
}

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot always write cookies; Route Handlers can.
          }
        },
      },
    },
  );
}

export async function getAuthContext() {
  if (isGuestMode()) return { userId: "local-guest", email: "local@thread.test", isDemo: false };
  if (isOpenAccess()) {
    return {
      userId: process.env.PUBLIC_WORKSPACE_OWNER_ID ?? null,
      email: null,
      isDemo: false,
    };
  }
  const client = await createSupabaseServerClient();
  if (!client) return { userId: null, email: null, isDemo: false };
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return { userId: null, email: null, isDemo: false };
  return {
    userId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    isDemo: false,
  };
}
