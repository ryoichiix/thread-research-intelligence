import type { NextRequest } from "next/server";
import { projectSourcesGet } from "@/lib/api-handlers";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectSourcesGet(request, (await context.params).id);
}
