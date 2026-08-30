import type { NextRequest } from "next/server";
import { projectDelete, projectGet } from "@/lib/api-handlers";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectGet(request, (await context.params).id);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return projectDelete(request, (await context.params).id);
}
