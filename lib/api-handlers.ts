import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import type { Conflict, Evidence, Insight, ResearchGap, ResearchTask, Source } from "@thread/shared";
import { analyzeEvidence, compareResearchClaims, generateInsight, verifyAgainstResearch } from "@/lib/ai";
import { createEvidenceClaim } from "@/lib/analysis/claim-extraction";
import { analyzeSourceMetadata, calculateFreshnessScore } from "@/lib/analysis/source-intelligence";
import { calculateTopicCoverage } from "@/lib/analysis/research-health";
import { getDashboardSummary, getGraph } from "@/lib/research-view";
import {
  addClaim,
  addClaimRelation,
  addConflict,
  addEvidence,
  addInsight,
  addSource,
  addTimelineEvent,
  createProject,
  deleteProject,
  deleteResearchItem,
  findSourceByUrl,
  findSourceByDoi,
  getDataset,
  getProject,
  listEvidence,
  listProjects,
  listSources,
  resolveConflict,
  setSearchResultStatus,
  storeSearchResults,
  upsertResearchGap,
  upsertResearchTask,
} from "@/lib/repository";
import type { ResearchItemKind } from "@/lib/repository";
import {
  authInputSchema,
  compareInputSchema,
  conflictResolutionInputSchema,
  evidenceInputSchema,
  projectInputSchema,
  researchSearchInputSchema,
  searchDecisionInputSchema,
  sourceInputSchema,
  verifyInputSchema,
} from "@/lib/schemas";
import { apiError, corsHeaders, enforceRateLimit, parseJson } from "@/lib/security";
import { createSupabaseServerClient, getAuthContext } from "@/lib/supabase/server";
import { activeProjectCookie } from "@/lib/current-research";

function json(request: NextRequest, data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(request) });
}

async function requireContext(request: NextRequest) {
  const rateResponse = enforceRateLimit(request);
  if (rateResponse) return { response: rateResponse, context: null };
  const context = await getAuthContext();
  if (!context.isDemo && !context.userId) {
    return {
      response: json(request, { error: "Authentication required" }, 401),
      context: null,
    };
  }
  return { response: null, context };
}

export async function projectsGet(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const projects = await listProjects(context.userId);
    const requestedId = (await cookies()).get(activeProjectCookie)?.value;
    const activeProjectId = projects.some((project) => project.id === requestedId) ? requestedId : projects[0]?.id ?? null;
    return json(request, { projects, activeProjectId });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectsPost(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const input = await parseJson(request, projectInputSchema);
    const project = await createProject(context.userId, input);
    return json(request, { project }, 201);
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectGet(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const project = await getProject(id, context.userId);
    if (!project) return json(request, { error: "Project not found" }, 404);
    const dataset = await getDataset(id, context.userId);
    return json(request, { project, summary: dataset ? getDashboardSummary(dataset) : null });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectDelete(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const deleted = await deleteProject(id, context.userId);
    if (!deleted) return json(request, { error: "Project not found" }, 404);
    const remainingProjects = await listProjects(context.userId);
    const cookieStore = await cookies();
    cookieStore.delete(activeProjectCookie);
    return json(request, { deleted: true, nextProjectId: remainingProjects[0]?.id ?? null });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function researchItemDelete(
  request: NextRequest,
  projectId: string,
  kind: ResearchItemKind,
  itemId: string,
) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const deleted = await deleteResearchItem(projectId, context.userId, kind, itemId);
    if (!deleted) return json(request, { error: itemId.startsWith("derived:") ? "Computed conflicts must be removed by deleting their underlying claim or evidence." : "Research record not found" }, itemId.startsWith("derived:") ? 409 : 404);
    return json(request, { deleted: true });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function conflictResolutionPatch(
  request: NextRequest,
  projectId: string,
  conflictId: string,
) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const input = await parseJson(request, conflictResolutionInputSchema);
    const dataset = await getDataset(projectId, context.userId, ["evidence", "claims", "conflicts"]);
    const conflict = dataset?.conflicts.find((item) => item.id === conflictId);
    if (!conflict) return json(request, { error: "Contradiction not found" }, 404);
    if (conflict.resolution === "resolved") return json(request, { error: "This contradiction has already been finalized." }, 409);

    const resolved = await resolveConflict(projectId, context.userId, conflict, input);
    const choiceLabel = input.choice.replaceAll("_", " ");
    await addTimelineEvent({
      id: crypto.randomUUID(),
      projectId,
      occurredAt: resolved.resolvedAt ?? new Date().toISOString(),
      type: "contradiction_resolved",
      title: "Contradiction decision finalized",
      description: `${resolved.title}: ${choiceLabel}. ${input.rationale}`,
      evidenceIds: [...new Set([...resolved.supportingEvidence, ...resolved.contradictingEvidence])],
      isDemo: false,
    });
    return json(request, { conflict: resolved });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function sourcesPost(request: NextRequest) {
  try {
    const { response } = await requireContext(request);
    if (response) return response;
    const input = await parseJson(request, sourceInputSchema);
    const intelligence = await analyzeSourceMetadata(input);
    const url = new URL(input.url);
    const source: Source = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: intelligence.title,
      url: input.url,
      domain: url.hostname,
      sourceType: intelligence.sourceType,
      documentType: intelligence.documentType,
      author: intelligence.author,
      authors: intelligence.authors,
      publicationDate: intelligence.publicationDate,
      publisher: intelligence.publisher,
      journal: intelligence.journal,
      doi: intelligence.doi,
      citationCount: intelligence.citationCount,
      referenceCount: intelligence.referenceCount,
      citedByUrl: intelligence.citedByUrl,
      pdfUrl: intelligence.pdfUrl,
      citationText: intelligence.citationText,
      metadataProvider: intelligence.metadataProvider,
      peerReviewStatus: intelligence.peerReviewStatus,
      authenticityScore: intelligence.authenticityScore,
      authenticityTier: intelligence.authenticityTier,
      authenticitySignals: intelligence.authenticitySignals,
      references: intelligence.references,
      summary: input.summary,
      limitations: intelligence.authenticitySignals.filter((signal) => /missing|informal|not independently/i.test(signal)),
      qualityScore: intelligence.authenticityScore,
      freshnessScore: calculateFreshnessScore(intelligence.publicationDate),
      evidenceIds: [],
      claimIds: [],
      discoveredAt: new Date().toISOString(),
      isDemo: false,
    };
    return json(request, { source: await addSource(source) }, 201);
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectSourcesGet(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    return json(request, { sources: await listSources(id, context.userId) });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function evidencePost(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const input = await parseJson(request, evidenceInputSchema);
    const project = await getProject(input.projectId, context.userId);
    if (!project) return json(request, { error: "Project not found" }, 404);
    const existingSource = await findSourceByUrl(input.projectId, input.url);
    const sourceIntelligence = existingSource ?? await analyzeSourceMetadata({
      title: input.pageTitle,
      url: input.url,
      author: input.author,
      authors: input.authors,
      publicationDate: input.publicationDate,
      documentType: input.documentType,
      publisher: input.publisher,
      journal: input.journal,
      doi: input.doi,
      citationCount: input.citationCount,
      referenceCount: input.referenceCount,
      citedByUrl: input.citedByUrl,
      pdfUrl: input.pdfUrl,
      metadataProvider: input.metadataProvider,
      references: input.references,
    });
    const matchedSource = existingSource ?? (sourceIntelligence.doi ? await findSourceByDoi(input.projectId, sourceIntelligence.doi) : null);
    const analysis = await analyzeEvidence({
      selectedText: input.selectedText,
      surroundingContext: input.surroundingContext,
      evidenceType: sourceIntelligence.sourceType,
      topic: input.topic,
    });
    let sourceId = input.sourceId;
    if (!sourceId) {
      const url = new URL(input.url);
      const source = matchedSource ?? await addSource({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        title: sourceIntelligence.title,
        url: input.url,
        domain: url.hostname,
        sourceType: sourceIntelligence.sourceType,
        documentType: sourceIntelligence.documentType,
        author: sourceIntelligence.author,
        authors: sourceIntelligence.authors,
        publicationDate: sourceIntelligence.publicationDate,
        publisher: sourceIntelligence.publisher,
        journal: sourceIntelligence.journal,
        doi: sourceIntelligence.doi,
        citationCount: sourceIntelligence.citationCount,
        referenceCount: sourceIntelligence.referenceCount,
        citedByUrl: sourceIntelligence.citedByUrl,
        pdfUrl: sourceIntelligence.pdfUrl,
        citationText: sourceIntelligence.citationText,
        metadataProvider: sourceIntelligence.metadataProvider,
        peerReviewStatus: sourceIntelligence.peerReviewStatus,
        authenticityScore: sourceIntelligence.authenticityScore,
        authenticityTier: sourceIntelligence.authenticityTier,
        authenticitySignals: sourceIntelligence.authenticitySignals,
        references: sourceIntelligence.references,
        summary: analysis.summary,
        limitations: [...analysis.limitations, ...sourceIntelligence.authenticitySignals.filter((signal) => /missing|informal|not independently/i.test(signal))],
        qualityScore: sourceIntelligence.authenticityScore,
        freshnessScore: calculateFreshnessScore(sourceIntelligence.publicationDate),
        evidenceIds: [],
        claimIds: [],
        discoveredAt: new Date().toISOString(),
        isDemo: false,
      });
      sourceId = source.id;
    }
    const item: Evidence = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      sourceId,
      selectedText: input.selectedText,
      surroundingContext: input.surroundingContext,
      pageTitle: input.pageTitle,
      url: input.url,
      author: sourceIntelligence.author,
      publicationDate: sourceIntelligence.publicationDate,
      capturedAt: new Date().toISOString(),
      evidenceType: sourceIntelligence.sourceType,
      ...analysis,
      isDemo: false,
    };
    await addEvidence(item);
    const claim = createEvidenceClaim(item);
    const dataset = await getDataset(input.projectId, context.userId);
    // Only compare claims within the same topic. The shared-word/polarity heuristic in
    // compareResearchClaims() needs as few as two overlapping generic words (e.g. "remote",
    // "engineer") to consider two claims comparable, which is trivially met by any two claims
    // in a project about the same broad subject. Without a topic boundary this produces
    // confident "contradictions" between claims that are not actually about the same finding
    // (e.g. a claim about onboarding experience vs. a claim about output metrics). Topic is
    // already the segmentation unit used everywhere else in this file (gaps, coverage, tasks),
    // so contradiction/relation detection is scoped the same way for consistency and correctness.
    const sameTopicClaims = (dataset?.claims ?? []).filter((existing) => existing.topic === claim.topic);
    const candidates = (await Promise.all(sameTopicClaims
      .map(async (existing) => ({
        existing,
        result: await compareResearchClaims({ left: claim.text, right: existing.text, leftMethodology: item.methodology }),
      }))))
      .filter(({ result }) => result.status !== "UNRELATED")
      .sort((a, b) => b.result.confidence - a.result.confidence);
    await addClaim(claim);
    const best = candidates[0];
    let conflict: Conflict | null = null;
    const relationTypeFor = (status: string) => status === "CONTRADICTED" || status === "TENSION"
      ? "CONTRADICTS" as const
      : status === "SUPPORTED" || status === "PARTIALLY_SUPPORTED"
        ? "SUPPORTS" as const
        : "RELATED_TO" as const;
    await Promise.all(candidates.slice(0, 5).map(({ existing, result }) =>
      addClaimRelation({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        fromClaimId: claim.id,
        toClaimId: existing.id,
        type: relationTypeFor(result.status),
        confidence: result.confidence,
        rationale: `${result.status}: ${result.explanation}`,
      }),
    ));
    const relationType = best ? relationTypeFor(best.result.status) : "RELATED_TO";
    if (best) {
      if (best.result.status === "CONTRADICTED" || best.result.status === "TENSION") {
        conflict = await addConflict({
          id: crypto.randomUUID(),
          projectId: input.projectId,
          topic: analysis.topic,
          title: `Conflicting claims about ${analysis.topic}`,
          status: best.result.status,
          severity: best.result.status === "TENSION" ? "minor" : best.result.confidence >= 0.88 ? "major" : "moderate",
          resolution: "unresolved",
          supportingEvidence: best.existing.evidenceIds,
          contradictingEvidence: [item.id],
          explanation: [best.result.explanation, best.result.status === "TENSION" ? "The direction differs, but a population, method, or condition mismatch means this is not yet a direct contradiction." : "Review population, method, date, and outcome definitions before resolving the disagreement."],
          confidence: best.result.confidence,
          isDemo: false,
        });
      }
    }
    const topicEvidence = [...(dataset?.evidence.filter((entry) => entry.topic === analysis.topic) ?? []), item];
    const topicEvidenceCount = topicEvidence.length;
    const coverage = calculateTopicCoverage({
      evidenceCount: topicEvidenceCount,
      sourceCount: new Set(topicEvidence.map((entry) => entry.sourceId)).size,
      methodCount: topicEvidence.filter((entry) => entry.methodology.length >= 18 && !/not available|unavailable|unknown/i.test(entry.methodology)).length,
    });
    const sourceCount = new Set(topicEvidence.map((entry) => entry.sourceId)).size;
    const methodCount = topicEvidence.filter((entry) => entry.methodology.length >= 18 && !/not available|unavailable|unknown/i.test(entry.methodology)).length;
    const gapReasons = [
      topicEvidenceCount < 5 ? `Only ${topicEvidenceCount} evidence unit${topicEvidenceCount === 1 ? "" : "s"} ${topicEvidenceCount === 1 ? "addresses" : "address"} this topic; isolated passages cannot establish breadth.` : "",
      sourceCount < 3 ? `The evidence comes from ${sourceCount} independent source${sourceCount === 1 ? "" : "s"}; corroboration across sources is still weak.` : "",
      methodCount < 2 ? `Only ${methodCount} item${methodCount === 1 ? "" : "s"} ${methodCount === 1 ? "documents" : "document"} a usable methodology, so study quality and comparability cannot be checked.` : "",
      !conflict ? "No opposing or falsifying evidence has been recorded for this topic yet." : "The current conflict is unresolved and needs an independent tie-breaking source.",
    ].filter(Boolean);
    const gap: ResearchGap = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      topic: analysis.topic,
      coverage,
      evidenceCount: topicEvidenceCount,
      confidence: Math.min(0.92, 0.55 + topicEvidenceCount * 0.06),
      whyItMatters: coverage < 70 ? `The evidence base for ${analysis.topic} is still too narrow for a defensible conclusion. ${gapReasons[0] ?? "More independent evidence is required."}` : `Coverage is improving, but independent methods and populations can still test this finding.`,
      reasons: gapReasons,
      missingDimensions: [topicEvidenceCount < 5 ? "evidence breadth" : "", sourceCount < 3 ? "independent corroboration" : "", methodCount < 2 ? "methodology" : "", !conflict ? "counterevidence" : "conflict resolution"].filter(Boolean),
      suggestedQuestions: [`Which populations or conditions are missing from the evidence on ${analysis.topic}?`, `What evidence would falsify the current leading claim?`],
      suggestedSearches: [`${project.researchQuestion} ${analysis.topic} systematic review`, `${analysis.topic} contradictory findings methodology`],
      isLargest: coverage < 50,
      isDemo: false,
    };
    await upsertResearchGap(gap);
    const task: ResearchTask = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: `Strengthen evidence for ${analysis.topic}`,
      reason: conflict ? "A direct contradiction needs independent evidence and methodological comparison." : `Coverage for this topic is ${coverage}%.`,
      expectedValue: conflict || coverage < 50 ? "High" : coverage < 80 ? "Medium" : "Low",
      evidenceAvailable: topicEvidenceCount,
      missingEvidence: "Independent sources, explicit methodology, population details, and measurable outcomes.",
      suggestedSearches: gap.suggestedSearches,
      status: "recommended",
      isDemo: false,
    };
    await upsertResearchTask(task);
    const insight: Insight = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      type: conflict ? "CONTRADICTION" : best ? "NEW_CONNECTION" : "SIGNIFICANT_FINDING",
      title: conflict ? conflict.title : best ? `New connection in ${analysis.topic}` : analysis.extractedClaim,
      description: conflict ? best!.result.explanation : best ? `The new claim is ${relationType.toLowerCase().replaceAll("_", " ")} an existing claim with ${Math.round(best.result.confidence * 100)}% comparison confidence.` : analysis.summary,
      confidence: best?.result.confidence ?? analysis.confidence,
      supportingEvidence: conflict ? best!.existing.evidenceIds : [item.id],
      contradictingEvidence: conflict ? [item.id] : [],
      relatedClaims: best ? [claim.id, best.existing.id] : [claim.id],
      recommendedAction: task.reason,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    await addInsight(insight);
    await addTimelineEvent({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      occurredAt: new Date().toISOString(),
      type: conflict ? "contradiction_detected" : "evidence_added",
      title: conflict ? "New evidence created a potential conflict" : "New evidence integrated",
      description: analysis.extractedClaim,
      evidenceIds: [item.id],
      isDemo: false,
    });
    return json(
      request,
      {
        evidence: item,
        claim,
        status: conflict ? "POTENTIAL_CONFLICT" : "CAPTURED",
        conflict,
        insight,
        gap,
        task,
      },
      201,
    );
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectEvidenceGet(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    return json(request, { evidence: await listEvidence(id, context.userId) });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function analyzeEvidencePost(request: NextRequest) {
  try {
    const { response } = await requireContext(request);
    if (response) return response;
    const input = await parseJson(request, evidenceInputSchema);
    return json(request, {
      analysis: await analyzeEvidence({
        selectedText: input.selectedText,
        surroundingContext: input.surroundingContext,
        evidenceType: input.evidenceType,
        topic: input.topic,
      }),
      mode: process.env.OPENAI_API_KEY ? "openai" : "deterministic",
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function verifyPost(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const input = await parseJson(request, verifyInputSchema);
    const dataset = await getDataset(input.projectId, context.userId);
    if (!dataset) return json(request, { error: "Project not found" }, 404);
    return json(request, await verifyAgainstResearch(input.claim, dataset));
  } catch (error) {
    return apiError(error, request);
  }
}

export async function comparePost(request: NextRequest) {
  try {
    const { response } = await requireContext(request);
    if (response) return response;
    const input = await parseJson(request, compareInputSchema);
    return json(request, await compareResearchClaims(input));
  } catch (error) {
    return apiError(error, request);
  }
}

async function datasetEndpoint(
  request: NextRequest,
  selector: (dataset: NonNullable<Awaited<ReturnType<typeof getDataset>>>) => unknown,
) {
  const { response, context } = await requireContext(request);
  if (response || !context) return response!;
  const body = await request.json();
  const projectId = z.object({ projectId: z.string().min(1) }).parse(body).projectId;
  const dataset = await getDataset(projectId, context.userId);
  if (!dataset) return json(request, { error: "Project not found" }, 404);
  return json(request, selector(dataset));
}

export async function insightsPost(request: NextRequest) {
  try {
    return await datasetEndpoint(request, (dataset) => ({
      insights: dataset.insights,
      generated: null,
    }));
  } catch (error) {
    return apiError(error, request);
  }
}

export async function generateInsightPost(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const { projectId } = z.object({ projectId: z.string().min(1) }).parse(await request.json());
    const dataset = await getDataset(projectId, context.userId);
    if (!dataset) return json(request, { error: "Project not found" }, 404);
    const insight = await generateInsight(dataset);
    await addInsight(insight);
    await addTimelineEvent({
      id: crypto.randomUUID(),
      projectId,
      occurredAt: new Date().toISOString(),
      type: "pattern_discovered",
      title: "Grounded research insight generated",
      description: insight.title,
      evidenceIds: insight.supportingEvidence,
      isDemo: false,
    });
    return json(request, { insight });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function gapsPost(request: NextRequest) {
  try {
    return await datasetEndpoint(request, (dataset) => ({
      gaps: dataset.gaps,
      largestGap: dataset.gaps.find((gap) => gap.isLargest) ?? null,
    }));
  } catch (error) {
    return apiError(error, request);
  }
}

export async function nextResearchPost(request: NextRequest) {
  try {
    return await datasetEndpoint(request, (dataset) => ({ tasks: dataset.tasks }));
  } catch (error) {
    return apiError(error, request);
  }
}

const tavilyResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.url(),
      content: z.string(),
      score: z.number().optional(),
    }),
  ),
});

const crossrefResponseSchema = z.object({
  message: z.object({
    items: z.array(z.object({
      DOI: z.string().optional(),
      title: z.array(z.string()).optional(),
      author: z.array(z.object({ given: z.string().optional(), family: z.string().optional() })).optional(),
      publisher: z.string().optional(),
      type: z.string().optional(),
      score: z.number().optional(),
      "container-title": z.array(z.string()).optional(),
      "is-referenced-by-count": z.number().optional(),
      published: z.object({ "date-parts": z.array(z.array(z.number())) }).optional(),
      "published-print": z.object({ "date-parts": z.array(z.array(z.number())) }).optional(),
      "published-online": z.object({ "date-parts": z.array(z.array(z.number())) }).optional(),
    }).passthrough()),
  }),
});

async function searchScholarlyWorks(projectId: string, query: string) {
  const parameters = new URLSearchParams({
    "query.bibliographic": query,
    rows: "12",
    select: "DOI,title,author,publisher,type,score,container-title,is-referenced-by-count,published,published-print,published-online",
  });
  const mailto = process.env.CROSSREF_MAILTO;
  if (mailto) parameters.set("mailto", mailto);
  const response = await fetch(`https://api.crossref.org/works?${parameters}`, {
    headers: { "User-Agent": `THREAD-Research-Intelligence/0.6${mailto ? ` (mailto:${mailto})` : ""}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Crossref returned ${response.status}`);
  const parsed = crossrefResponseSchema.parse(await response.json());
  const works = parsed.message.items
    .filter((item) => item.DOI && item.title?.[0])
    .map((item) => {
      const dateParts = item["published-print"]?.["date-parts"] ?? item["published-online"]?.["date-parts"] ?? item.published?.["date-parts"];
      const doi = item.DOI!;
      const title = item.title![0]!;
      return {
        id: crypto.randomUUID(),
        projectId,
        url: `https://doi.org/${doi}`,
        scholarUrl: `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${title}"`)}`,
        title,
        snippet: `${item.author?.slice(0, 4).map((author) => [author.given, author.family].filter(Boolean).join(" ")).join(", ") || "Authors unavailable"} · ${item["container-title"]?.[0] || item.publisher || "Publication venue unavailable"}`,
        authors: item.author?.map((author) => [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean) ?? [],
        journal: item["container-title"]?.[0] || "",
        publisher: item.publisher || "",
        year: dateParts?.[0]?.[0] ?? null,
        doi,
        citationCount: item["is-referenced-by-count"] ?? 0,
        citationProvider: "Crossref Cited-by",
        documentType: item.type || "journal-article",
        query,
        discoveredAt: new Date().toISOString(),
        status: "pending" as const,
        relevance: item.score ?? null,
      };
    });
  const maximumScore = Math.max(...works.map((work) => work.relevance ?? 0), 1);
  return works
    .map((work) => ({ ...work, relevance: work.relevance === null ? null : Math.min(1, work.relevance / maximumScore) }))
    .sort((left, right) => (right.citationCount - left.citationCount) || ((right.relevance ?? 0) - (left.relevance ?? 0)))
    .slice(0, 8);
}

async function searchWeb(projectId: string, query: string) {
  if (!process.env.SEARCH_API_KEY) return [];
  const searchResponse = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SEARCH_API_KEY}`,
      "Content-Type": "application/json",
      "X-Project-ID": projectId,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
      safe_search: true,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!searchResponse.ok) throw new Error(`Search provider returned ${searchResponse.status}`);
  const parsed = tavilyResponseSchema.parse(await searchResponse.json());
  return parsed.results.map((result) => ({
    id: crypto.randomUUID(),
    projectId,
    url: result.url,
    title: result.title,
    snippet: result.content,
    query,
    discoveredAt: new Date().toISOString(),
    status: "pending" as const,
    relevance: result.score ?? null,
  }));
}

export async function researchSearchPost(request: NextRequest) {
  try {
    const { response } = await requireContext(request);
    if (response) return response;
    const input = await parseJson(request, researchSearchInputSchema);
    const webConfigured = Boolean(process.env.SEARCH_API_KEY);
    const [paperSearch, webSearch] = await Promise.allSettled([
      searchScholarlyWorks(input.projectId, input.query),
      searchWeb(input.projectId, input.query),
    ]);
    const papers = paperSearch.status === "fulfilled" ? paperSearch.value : [];
    const results = webSearch.status === "fulfilled" ? webSearch.value : [];
    await Promise.allSettled([
      papers.length ? storeSearchResults(papers) : Promise.resolve(),
      results.length ? storeSearchResults(results) : Promise.resolve(),
    ]);
    const messages = [
      paperSearch.status === "rejected" ? "Scholarly metadata is temporarily unavailable." : "",
      webConfigured && webSearch.status === "rejected" ? "Wider web search is temporarily unavailable." : "",
      !webConfigured ? "Peer-reviewed candidates are live through Crossref; add SEARCH_API_KEY only for wider web search." : "",
    ].filter(Boolean);
    return json(request, {
      query: input.query,
      configured: webConfigured,
      scholarlyConfigured: papers.length > 0,
      papers,
      results: [...papers, ...results],
      message: messages.join(" "),
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function researchSearchDecisionPost(request: NextRequest) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const input = await parseJson(request, searchDecisionInputSchema);
    const project = await getProject(input.projectId, context.userId);
    if (!project) return json(request, { error: "Project not found" }, 404);
    return json(request, { result: await setSearchResultStatus(input.id, input.projectId, input.status) });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectGraphGet(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const dataset = await getDataset(id, context.userId);
    if (!dataset) return json(request, { error: "Project not found" }, 404);
    return json(request, getGraph(dataset));
  } catch (error) {
    return apiError(error, request);
  }
}

export async function projectTimelineGet(request: NextRequest, id: string) {
  try {
    const { response, context } = await requireContext(request);
    if (response || !context) return response!;
    const dataset = await getDataset(id, context.userId);
    if (!dataset) return json(request, { error: "Project not found" }, 404);
    return json(request, { timeline: dataset.timeline });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function authPost(request: NextRequest, action: "sign-in" | "sign-up") {
  try {
    const input = await parseJson(request, authInputSchema);
    const client = await createSupabaseServerClient();
    if (!client) return json(request, { error: "Supabase is not configured" }, 503);
    const result =
      action === "sign-in"
        ? await client.auth.signInWithPassword(input)
        : await client.auth.signUp({
            ...input,
            options: { emailRedirectTo: new URL("/api/auth/callback?next=/onboarding", request.url).toString() },
          });
    if (result.error) return json(request, { error: result.error.message }, 400);
    return json(request, {
      user: result.data.user,
      mode: "supabase",
      needsEmailConfirmation: action === "sign-up" && !result.data.session,
    });
  } catch (error) {
    return apiError(error, request);
  }
}

export async function logoutPost(request: NextRequest) {
  try {
    const client = await createSupabaseServerClient();
    await client?.auth.signOut();
    return json(request, { success: true });
  } catch (error) {
    return apiError(error, request);
  }
}
