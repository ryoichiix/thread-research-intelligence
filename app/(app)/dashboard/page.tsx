import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";
import { getDashboardSummary } from "@/lib/research-view";

export const metadata: Metadata = { title: "Research intelligence" };

export default async function DashboardPage() {
  const dataset = await getCurrentResearch();
  if (!dataset) return <section className="page-frame"><ResearchEmptyState /></section>;
  return (
    <section className="page-frame workbench-page">
      <DashboardClient summary={getDashboardSummary(dataset)} evidence={dataset.evidence} timeline={dataset.timeline} />
    </section>
  );
}
