import type { ResearchDataset } from "@thread/shared";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAuthContext } from "@/lib/supabase/server";
import { getDataset, listProjects, researchDatasetTables, type ResearchDatasetTable } from "@/lib/repository";

export const activeProjectCookie = "thread-active-project";

export type ResearchDatasetView = "full" | "graph" | "conflicts" | "coverage" | "timeline" | "source";

const tablesForView: Record<ResearchDatasetView, readonly ResearchDatasetTable[]> = {
  full: researchDatasetTables,
  graph: ["sources", "evidence", "claims", "claim_relations", "research_gaps", "conflicts"],
  conflicts: ["evidence", "claims", "conflicts"],
  coverage: ["evidence", "insights", "research_gaps", "research_tasks"],
  timeline: ["evidence", "timeline_events"],
  source: ["sources", "evidence", "claims", "conflicts"],
};

export const getResearchWorkspace = cache(async function getResearchWorkspace() {
  const context = await getAuthContext();
  if (!context.userId) return { context, projects: [], activeProjectId: null };
  const projects = await listProjects(context.userId);
  const requestedId = (await cookies()).get(activeProjectCookie)?.value;
  const activeProjectId = projects.some((project) => project.id === requestedId)
    ? requestedId!
    : projects[0]?.id ?? null;
  return { context, projects, activeProjectId };
});

export const getCurrentResearch = cache(async function getCurrentResearch(view: ResearchDatasetView = "full"): Promise<ResearchDataset | null> {
  const { context, activeProjectId } = await getResearchWorkspace();
  if (!context.userId || !activeProjectId) return null;
  return getDataset(activeProjectId, context.userId, tablesForView[view]);
});
