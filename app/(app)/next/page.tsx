import type { Metadata } from "next";
import { NextResearchClient } from "@/components/next-research-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Investigate next" };

export default async function NextResearchPage() {
  const dataset = await getCurrentResearch("coverage");
  if (!dataset?.tasks.length) return <section className="page-frame"><ResearchEmptyState title="No research tasks are ranked yet." description="Capture evidence and generate gaps before THREAD recommends the highest-value next investigation." /></section>;
  return <section className="page-frame"><NextResearchClient tasks={dataset.tasks} projectId={dataset.project.id} /></section>;
}
