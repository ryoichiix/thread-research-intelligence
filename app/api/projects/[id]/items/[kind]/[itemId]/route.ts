import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { researchItemDelete } from "@/lib/api-handlers";
import { corsHeaders } from "@/lib/security";

const kindSchema = z.enum([
  "source",
  "evidence",
  "claim",
  "relation",
  "insight",
  "gap",
  "task",
  "conflict",
  "timeline",
]);

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; kind: string; itemId: string }> },
) {
  const params = await context.params;
  const kind = kindSchema.safeParse(params.kind);
  if (!kind.success) {
    return NextResponse.json({ error: "Unsupported research record type" }, { status: 400, headers: corsHeaders(request) });
  }
  return researchItemDelete(request, params.id, kind.data, params.itemId);
}
