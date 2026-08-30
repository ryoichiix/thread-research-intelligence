import type { Metadata } from "next";
import { ResearchBookClient } from "@/components/research-book-client";
import { ResearchEmptyState } from "@/components/research-empty-state";
import { getCurrentResearch } from "@/lib/current-research";

export const metadata: Metadata = { title: "Research book" };

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ query?: string; focus?: string }> }) {
  const params = await searchParams;
  const dataset = await getCurrentResearch();
  if (!dataset) return <section className="page-frame"><ResearchEmptyState /></section>;
  return <section className="page-frame"><ResearchBookClient dataset={dataset} initialQuery={params.query ?? ""} focusSearch={params.focus === "search"} /></section>;
}
