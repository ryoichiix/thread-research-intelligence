import type { NextRequest } from "next/server";
import { conflictResolutionPatch } from "@/lib/api-handlers";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; conflictId: string }> },
) {
  const { id, conflictId } = await context.params;
  return conflictResolutionPatch(request, id, conflictId);
}
