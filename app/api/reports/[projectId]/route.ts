import { NextResponse } from "next/server";
import { getDataset } from "@/lib/repository";
import { generateResearchReport } from "@/lib/report";
import { getAuthContext } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await getAuthContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { projectId } = await params;
  const dataset = await getDataset(projectId, context.userId);
  if (!dataset) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const report = await generateResearchReport(dataset);
  const filename = `${dataset.project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "research"}-thread-report.pdf`;
  return new NextResponse(new Uint8Array(report), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
