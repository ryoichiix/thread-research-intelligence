import type { Metadata } from "next";
import { EvidenceTabs } from "@/components/evidence-tabs";
import { GraphLoader } from "@/components/graph-loader";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";
import { getGraph } from "@/lib/research-view";

export const metadata: Metadata = { title: "Evidence graph" };

export default async function GraphPage() {
  const dataset = await getCurrentResearch("graph");
  return (
    <section className="page-frame">
      <EvidenceTabs />
      {dataset
        ? <GraphLoader graph={getGraph(dataset)} evidence={dataset.evidence} />
        : <ResearchEmptyState title="Your evidence graph is ready to grow." />}
    </section>
  );
}
