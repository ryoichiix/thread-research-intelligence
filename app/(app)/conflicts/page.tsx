import type { Metadata } from "next";
import { ConflictsClient } from "@/components/conflicts-client";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Contradiction decision desk" };

export default async function ConflictsPage() {
  const dataset = await getCurrentResearch("conflicts");
  return (
    <section className="page-frame">
      <EvidenceTabs />
      {dataset?.conflicts.length
        ? <ConflictsClient conflicts={dataset.conflicts} evidence={dataset.evidence} />
        : <ResearchEmptyState title="No contradictions detected yet." description="Capture evidence from multiple sources. THREAD will surface conflicts only when stored claims genuinely disagree." />}
    </section>
  );
}
