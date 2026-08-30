import type { NextRequest } from "next/server";
import { projectGraphGet } from "@/lib/api-handlers";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectGraphGet(request, (await context.params).id);
}
