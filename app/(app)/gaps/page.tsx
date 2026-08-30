import type { Metadata } from "next";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { GapsClient } from "@/components/gaps-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Knowledge gaps" };

export default async function GapsPage() {
  const dataset = await getCurrentResearch("coverage");
  return (
    <section className="page-frame">
      <EvidenceTabs />
      {dataset?.gaps.length
        ? <GapsClient gaps={dataset.gaps} />
        : <ResearchEmptyState title="Knowledge gaps will appear here." description="Add enough real evidence for THREAD to measure coverage and identify missing populations, methods, outcomes, or time periods." />}
    </section>
  );
}
