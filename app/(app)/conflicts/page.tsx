import type { Metadata } from "next";
import { ConflictsClient } from "@/components/conflicts-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Contradiction decision desk" };

export default async function ConflictsPage() {
  const dataset = await getCurrentResearch("conflicts");
  if (!dataset?.conflicts.length) return <section className="page-frame"><ResearchEmptyState title="No contradictions detected yet." description="Capture evidence from multiple sources. THREAD will surface conflicts only when stored claims genuinely disagree." /></section>;
  return <section className="page-frame"><ConflictsClient conflicts={dataset.conflicts} evidence={dataset.evidence} /></section>;
}
