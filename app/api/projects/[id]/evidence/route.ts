import type { NextRequest } from "next/server";
import { projectEvidenceGet } from "@/lib/api-handlers";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectEvidenceGet(request, (await context.params).id);
}
