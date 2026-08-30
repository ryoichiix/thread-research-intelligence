import type { Metadata } from "next";
import { TimelineClient } from "@/components/timeline-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Research timeline" };

export default async function TimelinePage() {
  const dataset = await getCurrentResearch("timeline");
  if (!dataset?.timeline.length) return <section className="page-frame"><ResearchEmptyState title="Your research timeline is empty." description="Project changes, captured evidence, conflicts, insights, and generated tasks will appear here as your research evolves." /></section>;
  return <section className="page-frame"><TimelineClient timeline={dataset.timeline} evidence={dataset.evidence} /></section>;
}
