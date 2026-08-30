import type { NextRequest } from "next/server";
import { projectTimelineGet } from "@/lib/api-handlers";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectTimelineGet(request, (await context.params).id);
}
