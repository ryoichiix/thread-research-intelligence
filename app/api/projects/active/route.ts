import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activeProjectCookie } from "@/lib/current-research";
import { getProject } from "@/lib/repository";
import { getAuthContext } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const context = await getAuthContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { projectId } = z.object({ projectId: z.string().uuid() }).parse(await request.json());
  const project = await getProject(projectId, context.userId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const response = NextResponse.json({ activeProjectId: projectId, project });
  response.cookies.set(activeProjectCookie, projectId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
