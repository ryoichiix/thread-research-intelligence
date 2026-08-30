import type { Metadata } from "next";
import { GraphLoader } from "@/components/graph-loader";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";
import { getGraph } from "@/lib/research-view";

export const metadata: Metadata = { title: "Evidence graph" };

export default async function GraphPage() {
  const dataset = await getCurrentResearch("graph");
  if (!dataset) return <section className="page-frame"><ResearchEmptyState title="Your evidence graph is ready to grow." /></section>;
  return <section className="page-frame"><GraphLoader graph={getGraph(dataset)} evidence={dataset.evidence} /></section>;
}
