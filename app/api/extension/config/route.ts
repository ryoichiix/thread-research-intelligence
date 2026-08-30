import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, optionsResponse } from "@/lib/security";

export function GET(request: NextRequest) {
  return NextResponse.json(
    { product: "thread-research-intelligence", apiVersion: 1 },
    { headers: corsHeaders(request) },
  );
}

export const OPTIONS = (request: NextRequest) => optionsResponse(request);
