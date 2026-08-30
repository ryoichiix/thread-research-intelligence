import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Claim,
  ClaimRelation,
  Conflict,
  ConflictResolutionChoice,
  Evidence,
  Insight,
  Project,
  ResearchDataset,
  ResearchGap,
  ResearchTask,
  Source,
  TimelineEvent,
} from "@thread/shared";
import { createSupabaseServerClient, isGuestMode } from "@/lib/supabase/server";
import { calculateTopicCoverage } from "@/lib/analysis/research-health";
import { classifyContradiction } from "@/lib/analysis/contradiction";

type GuestState = {
  projects: Project[];
  sources: Source[];
  evidence: Evidence[];
  claims: Claim[];
  claimRelations: ClaimRelation[];
  insights: ResearchDataset["insights"];
  gaps: ResearchDataset["gaps"];
  tasks: ResearchDataset["tasks"];
  conflicts: ResearchDataset["conflicts"];
  timeline: TimelineEvent[];
};

export type ResearchItemKind =
  | "source"
  | "evidence"
  | "claim"
  | "relation"
  | "insight"
  | "gap"
  | "task"
  | "conflict"
  | "timeline";

export const researchDatasetTables = [
  "sources",
  "evidence",
  "claims",
  "claim_relations",
  "insights",
  "research_gaps",
  "research_tasks",
  "conflicts",
  "timeline_events",
] as const;

export type ResearchDatasetTable = (typeof researchDatasetTables)[number];

const guestDirectory = path.join(process.cwd(), ".thread");
const guestFile = path.join(guestDirectory, "guest-data.json");
const emptyGuestState = (): GuestState => ({ projects: [], sources: [], evidence: [], claims: [], claimRelations: [], insights: [], gaps: [], tasks: [], conflicts: [], timeline: [] });
let guestStatePromise: Promise<GuestState> | null = null;
// Some deployment runtimes (e.g. the Cloudflare Workers runtime used by `vinext dev`/`vinext build`)
// expose no writable filesystem at all, so `mkdir`/`writeFile` reject with EPERM/ENOSYS/EROFS.
// Guest mode is a convenience fallback for developing and demoing without Supabase, so it must
// never crash a request over this: the in-memory copy below (`guestStatePromise`, mutated in place
// by every caller) already keeps the session usable for the lifetime of the process. When disk
// persistence isn't available we simply keep serving from memory and stop retrying disk writes.
let guestFilePersistenceAvailable = true;

async function getGuestState() {
  guestStatePromise ??= readFile(guestFile, "utf8").then((value) => JSON.parse(value) as GuestState).catch(() => emptyGuestState());
  return guestStatePromise;
}

async function saveGuestState(state: GuestState) {
  // Keep the in-memory cache authoritative immediately so reads within this process
  // always see the latest state even if disk persistence below is unavailable or fails.
  guestStatePromise = Promise.resolve(state);
  if (!guestFilePersistenceAvailable) return;
  try {
    await mkdir(guestDirectory, { recursive: true });
    await writeFile(guestFile, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    guestFilePersistenceAvailable = false;
    console.warn(
      "THREAD guest mode: disk persistence is unavailable in this runtime (no writable filesystem). " +
        "Falling back to in-memory storage for the rest of this process; data will not survive a restart. " +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function removeGuestEvidence(state: GuestState, evidenceIds: Set<string>) {
  state.evidence = state.evidence.filter((item) => !evidenceIds.has(item.id));
  const removedClaimIds = new Set<string>();
  state.claims = state.claims.flatMap((claim) => {
    const remaining = claim.evidenceIds.filter((id) => !evidenceIds.has(id));
    if (!remaining.length) {
      removedClaimIds.add(claim.id);
      return [];
    }
    return [{ ...claim, evidenceIds: remaining }];
  });
  state.claimRelations = state.claimRelations.filter(
    (relation) => !removedClaimIds.has(relation.fromClaimId) && !removedClaimIds.has(relation.toClaimId),
  );
  state.insights = state.insights.flatMap((insight) => {
    const supportingEvidence = insight.supportingEvidence.filter((id) => !evidenceIds.has(id));
    if (!supportingEvidence.length) return [];
    return [{
      ...insight,
      supportingEvidence,
      contradictingEvidence: insight.contradictingEvidence.filter((id) => !evidenceIds.has(id)),
      relatedClaims: insight.relatedClaims.filter((id) => !removedClaimIds.has(id)),
    }];
  });
  state.conflicts = state.conflicts.flatMap((conflict) => {
    const supportingEvidence = conflict.supportingEvidence.filter((id) => !evidenceIds.has(id));
    const contradictingEvidence = conflict.contradictingEvidence.filter((id) => !evidenceIds.has(id));
    if (!supportingEvidence.length || !contradictingEvidence.length) return [];
    return [{ ...conflict, supportingEvidence, contradictingEvidence }];
  });
  state.timeline = state.timeline.flatMap((event) => {
    if (!event.evidenceIds.some((id) => evidenceIds.has(id))) return [event];
    const remaining = event.evidenceIds.filter((id) => !evidenceIds.has(id));
    return remaining.length ? [{ ...event, evidenceIds: remaining }] : [];
  });
}

const camelize = <T>(record: Record<string, unknown>) => {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    output[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return output as T;
};

const mapProject = (record: Record<string, unknown>) => {
  const project = camelize<Project & { userId?: string }>(record);
  return { ...project, ownerId: project.ownerId ?? project.userId ?? null } as Project;
};

const mapSource = (record: Record<string, unknown>) => {
  const source = camelize<Source & { bibliographyEntries?: Source["references"] }>(record);
  return {
    ...source,
    documentType: source.documentType ?? "unknown",
    authors: source.authors ?? (source.author && source.author !== "Unknown author" ? [source.author] : []),
    publisher: source.publisher ?? "",
    journal: source.journal ?? "",
    doi: source.doi ?? "",
    citationCount: source.citationCount ?? null,
    referenceCount: source.referenceCount ?? null,
    citedByUrl: source.citedByUrl ?? "",
    pdfUrl: source.pdfUrl ?? "",
    citationText: source.citationText ?? "",
    metadataProvider: source.metadataProvider ?? "page",
    peerReviewStatus: source.peerReviewStatus ?? "unknown",
    authenticityScore: source.authenticityScore ?? source.qualityScore ?? 0,
    authenticityTier: source.authenticityTier ?? "unverified",
    authenticitySignals: source.authenticitySignals ?? [],
    references: source.references ?? source.bibliographyEntries ?? [],
  } as Source;
};

const resolutionPrefix = {
  choice: "Resolution decision: ",
  rationale: "Resolution rationale: ",
  date: "Resolved at: ",
} as const;

const mapConflict = (record: Record<string, unknown>) => {
  const conflict = camelize<Conflict>(record);
  const notes = conflict.explanation ?? [];
  const choice = notes.find((note) => note.startsWith(resolutionPrefix.choice))?.slice(resolutionPrefix.choice.length) as ConflictResolutionChoice | undefined;
  const rationale = notes.find((note) => note.startsWith(resolutionPrefix.rationale))?.slice(resolutionPrefix.rationale.length);
  const resolvedAt = notes.find((note) => note.startsWith(resolutionPrefix.date))?.slice(resolutionPrefix.date.length);
  return {
    ...conflict,
    resolutionChoice: choice,
    resolutionRationale: rationale,
    resolvedAt,
  } as Conflict;
};

function normalizeCoverageRecords(
  evidence: Evidence[],
  gaps: ResearchGap[],
  tasks: ResearchTask[],
  insights: Insight[],
) {
  const recalculatedGaps = gaps.map((gap) => {
    const topicEvidence = evidence.filter((item) => item.topic === gap.topic);
    const sourceCount = new Set(topicEvidence.map((item) => item.sourceId)).size;
    const methodCount = topicEvidence.filter((item) => item.methodology?.length >= 18 && !/not available|unavailable|unknown/i.test(item.methodology)).length;
    const coverage = calculateTopicCoverage({
      evidenceCount: topicEvidence.length,
      sourceCount,
      methodCount,
    });
    const reasons = [
      topicEvidence.length < 5 ? `Only ${topicEvidence.length} evidence unit${topicEvidence.length === 1 ? "" : "s"} ${topicEvidence.length === 1 ? "addresses" : "address"} this topic.` : "",
      sourceCount < 3 ? `Only ${sourceCount} independent source${sourceCount === 1 ? "" : "s"} currently ${sourceCount === 1 ? "corroborates" : "corroborate"} this topic.` : "",
      methodCount < 2 ? `Only ${methodCount} evidence item${methodCount === 1 ? "" : "s"} ${methodCount === 1 ? "includes" : "include"} usable methodology details.` : "",
      "Population, outcome, limitation, and counterevidence coverage may still be incomplete until the topic audit is satisfied.",
    ].filter(Boolean);
    return {
      ...gap,
      coverage,
      evidenceCount: topicEvidence.length,
      whyItMatters: coverage < 70
        ? `The evidence base for ${gap.topic} is still too narrow for a defensible conclusion. ${reasons[0]}`
        : `Coverage is substantial, but independent methods, populations, and counterevidence can still test the finding.`,
      reasons,
      missingDimensions: [topicEvidence.length < 5 ? "evidence breadth" : "", sourceCount < 3 ? "independent corroboration" : "", methodCount < 2 ? "methodology" : "", "population and counterevidence audit"].filter(Boolean),
      isLargest: false,
    };
  });
  const lowestCoverage = Math.min(...recalculatedGaps.map((gap) => gap.coverage), Number.POSITIVE_INFINITY);
  const normalizedGaps = recalculatedGaps.map((gap) => ({ ...gap, isLargest: gap.coverage === lowestCoverage }));
  const gapFor = (label: string) => normalizedGaps.find((gap) => label.toLowerCase().includes(gap.topic.toLowerCase())) ?? normalizedGaps[0];
  const replaceCoverage = (value: string, coverage: number) => value.replace(/Coverage for this topic is \d+%\.?/gi, `Coverage for this topic is ${coverage}%.`);
  const normalizedTasks = tasks.map((task) => {
    const gap = gapFor(task.title);
    if (!gap) return task;
    return {
      ...task,
      reason: replaceCoverage(task.reason, gap.coverage),
      evidenceAvailable: gap.evidenceCount,
      expectedValue: gap.coverage < 50 ? "High" as const : gap.coverage < 80 ? "Medium" as const : "Low" as const,
    };
  });
  const normalizedInsights = insights.map((insight) => {
    const gap = gapFor(insight.title);
    if (!gap || !/Coverage for this topic is \d+%/i.test(insight.recommendedAction)) return insight;
    return { ...insight, recommendedAction: replaceCoverage(insight.recommendedAction, gap.coverage) };
  });
  return { gaps: normalizedGaps, tasks: normalizedTasks, insights: normalizedInsights };
}

function deriveMissingConflicts(projectId: string, claims: Claim[], evidence: Evidence[], stored: Conflict[]) {
  const output = stored.slice();
  const existingPairs = new Set(stored.flatMap((conflict) => conflict.supportingEvidence.flatMap((left) => conflict.contradictingEvidence.map((right) => [left, right].sort().join(":")))));
  for (let leftIndex = 0; leftIndex < Math.min(claims.length, 60); leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < Math.min(claims.length, 60); rightIndex += 1) {
      const left = claims[leftIndex]!;
      const right = claims[rightIndex]!;
      // Same fix as the capture-time comparison in api-handlers.ts's evidencePost: without a
      // topic boundary, the shared-word/polarity heuristic in classifyContradiction() readily
      // flags claims about different topics (e.g. onboarding experience vs. productivity output)
      // as contradicting each other just because they share a couple of generic words. This
      // recomputation pass runs on every dataset read, so it must apply the same scoping or it
      // silently re-introduces the exact cross-topic false positives the capture-time fix removed.
      if (left.topic !== right.topic) continue;
      const pairKey = [left.evidenceIds[0], right.evidenceIds[0]].filter(Boolean).sort().join(":");
      if (!pairKey || existingPairs.has(pairKey)) continue;
      const comparison = classifyContradiction({
        left: left.text,
        right: right.text,
        leftMethodology: evidence.find((item) => left.evidenceIds.includes(item.id))?.methodology,
        rightMethodology: evidence.find((item) => right.evidenceIds.includes(item.id))?.methodology,
      });
      if (comparison.status !== "CONTRADICTED" && comparison.status !== "TENSION") continue;
      output.push({
        id: `derived:${left.id}:${right.id}`,
        projectId,
        topic: left.topic,
        title: comparison.status === "TENSION" ? `Contextual tension between existing claims` : `Contradictory existing claims`,
        status: comparison.status,
        severity: comparison.status === "TENSION" ? "minor" : comparison.confidence >= 0.88 ? "major" : "moderate",
        resolution: "unresolved",
        supportingEvidence: left.evidenceIds,
        contradictingEvidence: right.evidenceIds,
        explanation: [comparison.explanation, "This conflict was re-evaluated from the current claim set using the latest contradiction rules."],
        confidence: comparison.confidence,
        isDemo: false,
      });
      existingPairs.add(pairKey);
    }
  }
  return output;
}

export async function listProjects(userId: string | null): Promise<Project[]> {
  if (isGuestMode()) return (await getGuestState()).projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const client = await createSupabaseServerClient();
  if (!client || !userId) return [];
  const { data, error } = await client.from("projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapProject(row));
}

export async function getProject(id: string, userId: string | null): Promise<Project | null> {
  if (isGuestMode()) return (await getGuestState()).projects.find((project) => project.id === id) ?? null;
  const client = await createSupabaseServerClient();
  if (!client || !userId) return null;
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProject(data) : null;
}

export async function createProject(
  userId: string | null,
  input: Pick<Project, "title" | "researchQuestion" | "description" | "tags">,
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    ownerId: userId,
    ...input,
    evidenceTarget: 20,
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };
  if (isGuestMode()) {
    const state = await getGuestState();
    state.projects.push(project);
    await saveGuestState(state);
    return project;
  }
  const client = await createSupabaseServerClient();
  if (!client || !userId) throw new Error("Authentication required");
  const { data, error } = await client
    .from("projects")
    .insert({
      id: project.id,
      user_id: userId,
      title: project.title,
      research_question: project.researchQuestion,
      description: project.description,
      tags: project.tags,
      evidence_target: project.evidenceTarget,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapProject(data);
}

export async function listSources(projectId: string, userId: string | null): Promise<Source[]> {
  if (isGuestMode()) return (await getGuestState()).sources.filter((source) => source.projectId === projectId);
  const client = await createSupabaseServerClient();
  if (!client || !userId) return [];
  const { data, error } = await client.from("sources").select("*").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((row) => mapSource(row));
}

export async function findSourceByUrl(projectId: string, url: string): Promise<Source | null> {
  if (isGuestMode()) return (await getGuestState()).sources.find((source) => source.projectId === projectId && source.url === url) ?? null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.from("sources").select("*").eq("project_id", projectId).eq("url", url).maybeSingle();
  if (error) throw error;
  return data ? mapSource(data) : null;
}

export async function findSourceByDoi(projectId: string, doi: string): Promise<Source | null> {
  if (!doi) return null;
  if (isGuestMode()) return (await getGuestState()).sources.find((source) => source.projectId === projectId && source.doi.toLowerCase() === doi.toLowerCase()) ?? null;
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.from("sources").select("*").eq("project_id", projectId).ilike("doi", doi).maybeSingle();
  if (error) throw error;
  return data ? mapSource(data) : null;
}

export async function listEvidence(projectId: string, userId: string | null): Promise<Evidence[]> {
  if (isGuestMode()) return (await getGuestState()).evidence.filter((item) => item.projectId === projectId);
  const client = await createSupabaseServerClient();
  if (!client || !userId) return [];
  const { data, error } = await client.from("evidence").select("*").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((row) => camelize<Evidence>(row));
}

export async function getDataset(
  projectId: string,
  userId: string | null,
  tableNames: readonly ResearchDatasetTable[] = researchDatasetTables,
): Promise<ResearchDataset | null> {
  if (isGuestMode()) {
    const state = await getGuestState();
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return null;
    const evidence = state.evidence.filter((item) => item.projectId === projectId);
    const claims = state.claims.filter((item) => item.projectId === projectId);
    const sources = state.sources.filter((item) => item.projectId === projectId).map((source) => ({
      ...source,
      evidenceIds: evidence.filter((item) => item.sourceId === source.id).map((item) => item.id),
      claimIds: claims.filter((claim) => claim.evidenceIds.some((id) => evidence.some((item) => item.id === id && item.sourceId === source.id))).map((claim) => claim.id),
    }));
    const normalized = normalizeCoverageRecords(
      evidence,
      state.gaps.filter((item) => item.projectId === projectId),
      state.tasks.filter((item) => item.projectId === projectId),
      state.insights.filter((item) => item.projectId === projectId),
    );
    return {
      project,
      sources,
      evidence,
      claims,
      claimRelations: state.claimRelations.filter((item) => item.projectId === projectId),
      insights: normalized.insights,
      gaps: normalized.gaps,
      tasks: normalized.tasks,
      conflicts: deriveMissingConflicts(projectId, claims, evidence, state.conflicts.filter((item) => item.projectId === projectId)),
      timeline: state.timeline.filter((item) => item.projectId === projectId),
    };
  }
  const client = await createSupabaseServerClient();
  if (!client || !userId) return null;
  const nestedSelect = ["*", ...tableNames.map((table) => `${table}(*)`)].join(",");
  const { data, error } = await client
    .from("projects")
    .select(nestedSelect)
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const projectRecord = data as Record<string, unknown> | null;
  const project = projectRecord ? mapProject(projectRecord) : null;
  if (!project) return null;
  const rowsFor = (table: ResearchDatasetTable) => {
    const rows = projectRecord?.[table];
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  };
  const evidence = rowsFor("evidence").map((row) => camelize(row)) as ResearchDataset["evidence"];
  const claims = rowsFor("claims").map((row) => camelize(row)) as ResearchDataset["claims"];
  const sources = rowsFor("sources").map((row) => mapSource(row)).map((source) => ({
    ...source,
    evidenceIds: evidence.filter((item) => item.sourceId === source.id).map((item) => item.id),
    claimIds: claims.filter((claim) => claim.evidenceIds.some((id) => evidence.some((item) => item.id === id && item.sourceId === source.id))).map((claim) => claim.id),
  }));
  const normalized = normalizeCoverageRecords(
    evidence,
    rowsFor("research_gaps").map((row) => camelize(row)) as ResearchDataset["gaps"],
    rowsFor("research_tasks").map((row) => camelize(row)) as ResearchDataset["tasks"],
    rowsFor("insights").map((row) => camelize(row)) as ResearchDataset["insights"],
  );
  return {
    project,
    sources,
    evidence,
    claims,
    claimRelations: rowsFor("claim_relations").map((row) => camelize(row)) as ResearchDataset["claimRelations"],
    insights: normalized.insights,
    gaps: normalized.gaps,
    tasks: normalized.tasks,
    conflicts: deriveMissingConflicts(projectId, claims, evidence, rowsFor("conflicts").map((row) => mapConflict(row))),
    timeline: rowsFor("timeline_events").map((row) => camelize(row)) as ResearchDataset["timeline"],
  };
}

export async function addSource(source: Source): Promise<Source> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.sources.push({ ...source, isDemo: false });
    await saveGuestState(state);
    return source;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client
    .from("sources")
    .insert({
      id: source.id,
      project_id: source.projectId,
      title: source.title,
      url: source.url,
      domain: source.domain,
      source_type: source.sourceType,
      document_type: source.documentType,
      author: source.author,
      authors: source.authors,
      publication_date: source.publicationDate || null,
      publisher: source.publisher,
      journal: source.journal,
      doi: source.doi,
      citation_count: source.citationCount,
      reference_count: source.referenceCount,
      cited_by_url: source.citedByUrl,
      pdf_url: source.pdfUrl,
      citation_text: source.citationText,
      metadata_provider: source.metadataProvider,
      peer_review_status: source.peerReviewStatus,
      authenticity_score: source.authenticityScore,
      authenticity_tier: source.authenticityTier,
      authenticity_signals: source.authenticitySignals,
      bibliography_entries: source.references,
      summary: source.summary,
      limitations: source.limitations,
      quality_score: source.qualityScore,
      freshness_score: source.freshnessScore,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSource(data);
}

export async function addEvidence(item: Evidence): Promise<Evidence> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.evidence.push({ ...item, isDemo: false });
    await saveGuestState(state);
    return item;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client
    .from("evidence")
    .insert({
      id: item.id,
      project_id: item.projectId,
      source_id: item.sourceId,
      selected_text: item.selectedText,
      surrounding_context: item.surroundingContext,
      page_title: item.pageTitle,
      url: item.url,
      author: item.author,
      publication_date: item.publicationDate || null,
      captured_at: item.capturedAt,
      evidence_type: item.evidenceType,
      extracted_claim: item.extractedClaim,
      summary: item.summary,
      stance: item.stance,
      confidence: item.confidence,
      methodology: item.methodology,
      limitations: item.limitations,
      topic: item.topic,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return camelize<Evidence>(data);
}

export async function addClaim(claim: Claim): Promise<Claim> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.claims.push({ ...claim, isDemo: false });
    await saveGuestState(state);
    return claim;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client
    .from("claims")
    .insert({
      id: claim.id,
      project_id: claim.projectId,
      text: claim.text,
      confidence: claim.confidence,
      topic: claim.topic,
      entities: claim.entities,
      evidence_ids: claim.evidenceIds,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return camelize<Claim>(data);
}

export async function addClaimRelation(relation: ClaimRelation): Promise<ClaimRelation> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.claimRelations.push(relation);
    await saveGuestState(state);
    return relation;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client
    .from("claim_relations")
    .insert({
      id: relation.id,
      project_id: relation.projectId,
      from_claim_id: relation.fromClaimId,
      to_claim_id: relation.toClaimId,
      type: relation.type,
      confidence: relation.confidence,
      rationale: relation.rationale,
    })
    .select("*")
    .single();
  if (error) throw error;
  return camelize<ClaimRelation>(data);
}

export async function addTimelineEvent(event: TimelineEvent): Promise<TimelineEvent> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.timeline.unshift({ ...event, isDemo: false });
    await saveGuestState(state);
    return event;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client
    .from("timeline_events")
    .insert({
      id: event.id,
      project_id: event.projectId,
      occurred_at: event.occurredAt,
      type: event.type,
      title: event.title,
      description: event.description,
      evidence_ids: event.evidenceIds,
      is_demo: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return camelize<TimelineEvent>(data);
}

export async function addInsight(insight: Insight): Promise<Insight> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.insights.unshift({ ...insight, isDemo: false });
    await saveGuestState(state);
    return insight;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.from("insights").insert({
    id: insight.id,
    project_id: insight.projectId,
    type: insight.type,
    title: insight.title,
    description: insight.description,
    confidence: insight.confidence,
    supporting_evidence: insight.supportingEvidence,
    contradicting_evidence: insight.contradictingEvidence,
    related_claims: insight.relatedClaims,
    recommended_action: insight.recommendedAction,
    is_demo: false,
    created_at: insight.createdAt,
  }).select("*").single();
  if (error) throw error;
  return camelize<Insight>(data);
}

export async function addConflict(conflict: Conflict): Promise<Conflict> {
  if (isGuestMode()) {
    const state = await getGuestState();
    state.conflicts.unshift({ ...conflict, isDemo: false });
    await saveGuestState(state);
    return conflict;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.from("conflicts").insert({
    id: conflict.id,
    project_id: conflict.projectId,
    topic: conflict.topic,
    title: conflict.title,
    status: conflict.status,
    severity: conflict.severity,
    resolution: conflict.resolution,
    supporting_evidence: conflict.supportingEvidence,
    contradicting_evidence: conflict.contradictingEvidence,
    explanation: conflict.explanation,
    confidence: conflict.confidence,
    is_demo: false,
  }).select("*").single();
  if (error) throw error;
  return mapConflict(data);
}

export async function resolveConflict(
  projectId: string,
  userId: string | null,
  conflict: Conflict,
  decision: { choice: ConflictResolutionChoice; rationale: string },
): Promise<Conflict> {
  const project = await getProject(projectId, userId);
  if (!project) throw new Error("Project not found");
  if (conflict.resolution === "resolved") throw new Error("This contradiction has already been finalized.");

  const resolvedAt = new Date().toISOString();
  const explanation = [
    ...conflict.explanation.filter((note) => !Object.values(resolutionPrefix).some((prefix) => note.startsWith(prefix))),
    `${resolutionPrefix.choice}${decision.choice}`,
    `${resolutionPrefix.rationale}${decision.rationale}`,
    `${resolutionPrefix.date}${resolvedAt}`,
  ];
  const resolvedId = conflict.id.startsWith("derived:") ? crypto.randomUUID() : conflict.id;
  const resolved: Conflict = {
    ...conflict,
    id: resolvedId,
    resolution: "resolved",
    explanation,
    resolutionChoice: decision.choice,
    resolutionRationale: decision.rationale,
    resolvedAt,
    isDemo: false,
  };

  if (isGuestMode()) {
    const state = await getGuestState();
    const storedIndex = state.conflicts.findIndex((item) => item.id === conflict.id && item.projectId === projectId);
    if (storedIndex >= 0) state.conflicts[storedIndex] = resolved;
    else state.conflicts.unshift(resolved);
    await saveGuestState(state);
    return resolved;
  }

  const client = await createSupabaseServerClient();
  if (!client || !userId) throw new Error("Authentication required");
  const record = {
    project_id: projectId,
    topic: resolved.topic,
    title: resolved.title,
    status: resolved.status,
    severity: resolved.severity,
    resolution: resolved.resolution,
    supporting_evidence: resolved.supportingEvidence,
    contradicting_evidence: resolved.contradictingEvidence,
    explanation,
    confidence: resolved.confidence,
    is_demo: false,
  };
  const query = conflict.id.startsWith("derived:")
    ? client.from("conflicts").insert({ id: resolvedId, ...record })
    : client.from("conflicts").update(record).eq("id", conflict.id).eq("project_id", projectId);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return mapConflict(data);
}

export async function upsertResearchGap(gap: ResearchGap): Promise<ResearchGap> {
  if (isGuestMode()) {
    const state = await getGuestState();
    const index = state.gaps.findIndex((item) => item.projectId === gap.projectId && item.topic === gap.topic);
    if (index >= 0) state.gaps[index] = { ...gap, id: state.gaps[index].id, isDemo: false };
    else state.gaps.push({ ...gap, isDemo: false });
    await saveGuestState(state);
    return index >= 0 ? state.gaps[index] : gap;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.from("research_gaps").upsert({
    id: gap.id,
    project_id: gap.projectId,
    topic: gap.topic,
    coverage: gap.coverage,
    evidence_count: gap.evidenceCount,
    confidence: gap.confidence,
    why_it_matters: gap.whyItMatters,
    suggested_questions: gap.suggestedQuestions,
    suggested_searches: gap.suggestedSearches,
    is_largest: gap.isLargest,
    is_demo: false,
  }, { onConflict: "project_id,topic", ignoreDuplicates: false }).select("*").single();
  if (error) throw error;
  return camelize<ResearchGap>(data);
}

export async function upsertResearchTask(task: ResearchTask): Promise<ResearchTask> {
  if (isGuestMode()) {
    const state = await getGuestState();
    const index = state.tasks.findIndex((item) => item.projectId === task.projectId && item.title === task.title);
    if (index >= 0) state.tasks[index] = { ...task, id: state.tasks[index].id, isDemo: false };
    else state.tasks.push({ ...task, isDemo: false });
    await saveGuestState(state);
    return index >= 0 ? state.tasks[index] : task;
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data: existing, error: findError } = await client.from("research_tasks").select("id").eq("project_id", task.projectId).eq("title", task.title).maybeSingle();
  if (findError) throw findError;
  const row = {
    project_id: task.projectId,
    title: task.title,
    reason: task.reason,
    expected_value: task.expectedValue,
    evidence_available: task.evidenceAvailable,
    missing_evidence: task.missingEvidence,
    suggested_searches: task.suggestedSearches,
    status: task.status,
    is_demo: false,
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? client.from("research_tasks").update(row).eq("id", existing.id)
    : client.from("research_tasks").insert({ id: task.id, ...row });
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return camelize<ResearchTask>(data);
}

export interface StoredSearchResult {
  id: string;
  projectId: string;
  url: string;
  title: string;
  snippet: string;
  query: string;
  discoveredAt: string;
  status: "pending" | "saved" | "rejected";
  relevance: number | null;
}

export async function storeSearchResults(results: StoredSearchResult[]) {
  if (!results.length || isGuestMode()) return results;
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { error } = await client.from("search_results").upsert(results.map((result) => ({
    id: result.id,
    project_id: result.projectId,
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    query: result.query,
    discovered_at: result.discoveredAt,
    status: result.status,
  })), { onConflict: "project_id,url,query", ignoreDuplicates: false });
  if (error) throw error;
  return results;
}

export async function setSearchResultStatus(id: string, projectId: string, status: "saved" | "rejected") {
  if (isGuestMode()) return { id, projectId, status };
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured");
  const { data, error } = await client.from("search_results").update({ status }).eq("id", id).eq("project_id", projectId).select("*").single();
  if (error) throw error;
  return camelize(data);
}

export async function deleteProject(projectId: string, userId: string | null) {
  if (isGuestMode()) {
    const state = await getGuestState();
    const owned = state.projects.some((project) => project.id === projectId);
    if (!owned) return false;
    state.projects = state.projects.filter((project) => project.id !== projectId);
    state.sources = state.sources.filter((item) => item.projectId !== projectId);
    state.evidence = state.evidence.filter((item) => item.projectId !== projectId);
    state.claims = state.claims.filter((item) => item.projectId !== projectId);
    state.claimRelations = state.claimRelations.filter((item) => item.projectId !== projectId);
    state.insights = state.insights.filter((item) => item.projectId !== projectId);
    state.gaps = state.gaps.filter((item) => item.projectId !== projectId);
    state.tasks = state.tasks.filter((item) => item.projectId !== projectId);
    state.conflicts = state.conflicts.filter((item) => item.projectId !== projectId);
    state.timeline = state.timeline.filter((item) => item.projectId !== projectId);
    await saveGuestState(state);
    return true;
  }
  const client = await createSupabaseServerClient();
  if (!client || !userId) return false;
  const { data, error } = await client
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

export async function deleteResearchItem(
  projectId: string,
  userId: string | null,
  kind: ResearchItemKind,
  itemId: string,
) {
  const project = await getProject(projectId, userId);
  if (!project) return false;
  if (itemId.startsWith("derived:")) return false;

  if (isGuestMode()) {
    const state = await getGuestState();
    if (kind === "source") {
      const evidenceIds = new Set(state.evidence.filter((item) => item.projectId === projectId && item.sourceId === itemId).map((item) => item.id));
      removeGuestEvidence(state, evidenceIds);
      state.sources = state.sources.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else if (kind === "evidence") {
      removeGuestEvidence(state, new Set([itemId]));
    } else if (kind === "claim") {
      state.claims = state.claims.filter((item) => item.id !== itemId || item.projectId !== projectId);
      state.claimRelations = state.claimRelations.filter((item) => item.fromClaimId !== itemId && item.toClaimId !== itemId);
      state.insights = state.insights.map((item) => ({ ...item, relatedClaims: item.relatedClaims.filter((id) => id !== itemId) }));
    } else if (kind === "relation") {
      state.claimRelations = state.claimRelations.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else if (kind === "insight") {
      state.insights = state.insights.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else if (kind === "gap") {
      state.gaps = state.gaps.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else if (kind === "task") {
      state.tasks = state.tasks.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else if (kind === "conflict") {
      state.conflicts = state.conflicts.filter((item) => item.id !== itemId || item.projectId !== projectId);
    } else {
      state.timeline = state.timeline.filter((item) => item.id !== itemId || item.projectId !== projectId);
    }
    await saveGuestState(state);
    return true;
  }

  const client = await createSupabaseServerClient();
  if (!client || !userId) return false;

  if (kind === "source") {
    const dataset = await getDataset(projectId, userId);
    const evidenceIds = dataset?.evidence.filter((item) => item.sourceId === itemId).map((item) => item.id) ?? [];
    for (const evidenceId of evidenceIds) {
      await deleteResearchItem(projectId, userId, "evidence", evidenceId);
    }
  }

  if (kind === "evidence") {
    const dataset = await getDataset(projectId, userId);
    if (!dataset?.evidence.some((item) => item.id === itemId)) return false;
    const affectedClaims = dataset.claims.filter((claim) => claim.evidenceIds.includes(itemId));
    const removedClaimIds = new Set<string>();
    for (const claim of affectedClaims) {
      const remaining = claim.evidenceIds.filter((id) => id !== itemId);
      if (remaining.length) {
        const { error } = await client.from("claims").update({ evidence_ids: remaining }).eq("id", claim.id).eq("project_id", projectId);
        if (error) throw error;
      } else {
        const { error } = await client.from("claims").delete().eq("id", claim.id).eq("project_id", projectId);
        if (error) throw error;
        removedClaimIds.add(claim.id);
      }
    }
    for (const insight of dataset.insights.filter((item) => item.supportingEvidence.includes(itemId) || item.contradictingEvidence.includes(itemId) || item.relatedClaims.some((id) => removedClaimIds.has(id)))) {
      const supportingEvidence = insight.supportingEvidence.filter((id) => id !== itemId);
      if (!supportingEvidence.length) {
        const { error } = await client.from("insights").delete().eq("id", insight.id).eq("project_id", projectId);
        if (error) throw error;
      } else {
        const { error } = await client.from("insights").update({
          supporting_evidence: supportingEvidence,
          contradicting_evidence: insight.contradictingEvidence.filter((id) => id !== itemId),
          related_claims: insight.relatedClaims.filter((id) => !removedClaimIds.has(id)),
        }).eq("id", insight.id).eq("project_id", projectId);
        if (error) throw error;
      }
    }
    for (const conflict of dataset.conflicts.filter((item) => !item.id.startsWith("derived:") && (item.supportingEvidence.includes(itemId) || item.contradictingEvidence.includes(itemId)))) {
      const supportingEvidence = conflict.supportingEvidence.filter((id) => id !== itemId);
      const contradictingEvidence = conflict.contradictingEvidence.filter((id) => id !== itemId);
      const query = !supportingEvidence.length || !contradictingEvidence.length
        ? client.from("conflicts").delete().eq("id", conflict.id).eq("project_id", projectId)
        : client.from("conflicts").update({ supporting_evidence: supportingEvidence, contradicting_evidence: contradictingEvidence }).eq("id", conflict.id).eq("project_id", projectId);
      const { error } = await query;
      if (error) throw error;
    }
    for (const event of dataset.timeline.filter((item) => item.evidenceIds.includes(itemId))) {
      const remaining = event.evidenceIds.filter((id) => id !== itemId);
      const query = remaining.length
        ? client.from("timeline_events").update({ evidence_ids: remaining }).eq("id", event.id).eq("project_id", projectId)
        : client.from("timeline_events").delete().eq("id", event.id).eq("project_id", projectId);
      const { error } = await query;
      if (error) throw error;
    }
    const { error: embeddingError } = await client.from("embeddings").delete().eq("project_id", projectId).eq("entity_type", "evidence").eq("entity_id", itemId);
    if (embeddingError) throw embeddingError;
  }

  if (kind === "claim") {
    const dataset = await getDataset(projectId, userId);
    for (const insight of dataset?.insights.filter((item) => item.relatedClaims.includes(itemId)) ?? []) {
      const { error } = await client.from("insights").update({ related_claims: insight.relatedClaims.filter((id) => id !== itemId) }).eq("id", insight.id).eq("project_id", projectId);
      if (error) throw error;
    }
    const { error: embeddingError } = await client.from("embeddings").delete().eq("project_id", projectId).eq("entity_type", "claim").eq("entity_id", itemId);
    if (embeddingError) throw embeddingError;
  }

  const embeddingKinds: Partial<Record<ResearchItemKind, string>> = {
    source: "source",
    insight: "insight",
    gap: "gap",
  };
  const embeddingKind = embeddingKinds[kind];
  if (embeddingKind) {
    const { error: embeddingError } = await client.from("embeddings").delete().eq("project_id", projectId).eq("entity_type", embeddingKind).eq("entity_id", itemId);
    if (embeddingError) throw embeddingError;
  }

  const tables: Record<ResearchItemKind, string> = {
    source: "sources",
    evidence: "evidence",
    claim: "claims",
    relation: "claim_relations",
    insight: "insights",
    gap: "research_gaps",
    task: "research_tasks",
    conflict: "conflicts",
    timeline: "timeline_events",
  };
  const { data, error } = await client
    .from(tables[kind])
    .delete()
    .eq("id", itemId)
    .eq("project_id", projectId)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}
