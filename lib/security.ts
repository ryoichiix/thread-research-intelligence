import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RateRecord = { count: number; resetAt: number };
const rateStore = new Map<string, RateRecord>();

export function enforceRateLimit(request: NextRequest, limit = 60, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || "local";
  const now = Date.now();
  const current = rateStore.get(key);
  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (current.count >= limit) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: corsHeaders(request) },
    );
  }
  current.count += 1;
  return null;
}

export function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.EXTENSION_ALLOWED_ORIGINS ?? "chrome-extension://*,moz-extension://*,http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const wildcardMatches = (value: string) =>
    Boolean(origin) && ((value === "chrome-extension://*" && origin!.startsWith("chrome-extension://")) || (value === "moz-extension://*" && origin!.startsWith("moz-extension://")));
  const approved = origin && (origin === request.nextUrl.origin || allowed.some((value) => value === origin || wildcardMatches(value)))
    ? origin
    : allowed.find((value) => !value.endsWith("*")) ?? request.nextUrl.origin;
  return {
    "Access-Control-Allow-Origin": approved,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "private, no-store",
  };
}

export async function parseJson<T extends z.ZodType>(request: NextRequest, schema: T) {
  const data: unknown = await request.json();
  return schema.parse(data) as z.infer<T>;
}

export function apiError(error: unknown, request: NextRequest) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400, headers: corsHeaders(request) },
    );
  }
  console.error("THREAD API error", error);
  return NextResponse.json(
    { error: "The request could not be completed." },
    { status: 500, headers: corsHeaders(request) },
  );
}

export function optionsResponse(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
