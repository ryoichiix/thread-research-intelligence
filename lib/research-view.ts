import type { DashboardSummary, Evidence, GraphAnalysis, GraphEdge, GraphNode, ResearchDataset } from "@thread/shared";
import { calculateResearchHealth } from "@/lib/analysis/research-health";

export function getDashboardSummary(dataset: ResearchDataset): DashboardSummary {
  const sourceCounts = new Map<string, number>();
  for (const source of dataset.sources) {
    sourceCounts.set(source.sourceType, (sourceCounts.get(source.sourceType) ?? 0) + 1);
  }
  const stanceNames: Evidence["stance"][] = ["supports", "contradicts", "neutral", "unclear"];
  const health = calculateResearchHealth(dataset);
  const timeline = dataset.timeline.slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const healthTrend = timeline.length
    ? [{ label: "Start", score: 0 }, ...timeline.slice(-5).map((event, index, events) => ({
        label: new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: Math.round(health.overall * ((index + 1) / events.length)),
      }))]
    : [{ label: "Start", score: 0 }, { label: "Now", score: health.overall }];
  const evidenceGrowth = dataset.evidence.length
    ? dataset.evidence
        .slice()
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
        .reduce<Array<{ label: string; evidence: number }>>((points, item, index) => {
          const label = new Date(item.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const previous = points.at(-1);
          if (previous?.label === label) previous.evidence = index + 1;
          else points.push({ label, evidence: index + 1 });
          return points;
        }, [])
        .slice(-6)
    : [{ label: "Now", evidence: 0 }];

  return {
    project: dataset.project,
    health,
    counts: {
      sources: dataset.sources.length,
      evidence: dataset.evidence.length,
      claims: dataset.claims.length,
      conflicts: dataset.conflicts.length,
      gaps: dataset.gaps.length,
    },
    insights: dataset.insights,
    healthTrend,
    evidenceGrowth,
    stanceDistribution: stanceNames.map((stance) => ({
      name: stance,
      value: dataset.evidence.filter((item) => item.stance === stance).length,
    })),
    topicCoverage: dataset.gaps.map((gap) => ({ topic: gap.topic, coverage: gap.coverage })),
    sourceDistribution: [...sourceCounts.entries()].map(([type, count]) => ({ type, count })),
  };
}

export function getGraph(dataset: ResearchDataset): { nodes: GraphNode[]; edges: GraphEdge[]; analysis: GraphAnalysis } {
  const claims = dataset.claims.slice(0, 40);
  const claimIds = new Set(claims.map((claim) => claim.id));
  const evidence = dataset.evidence
    .filter((item) => claims.some((claim) => claim.evidenceIds.includes(item.id)))
    .slice(0, 60);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const sources = dataset.sources.filter((source) => evidence.some((item) => item.sourceId === source.id)).slice(0, 30);
  const gaps = dataset.gaps.slice(0, 12);
  const questionId = `question:${dataset.project.id}`;
  const nodes: GraphNode[] = [
    { id: questionId, kind: "question", label: dataset.project.researchQuestion, detail: "The research question organizing this evidence graph." },
    ...claims.map((claim) => ({ id: claim.id, kind: "claim" as const, label: claim.text, detail: `${claim.topic} · ${claim.evidenceIds.length} linked evidence`, confidence: claim.confidence, evidenceIds: claim.evidenceIds })),
    ...evidence.map((item) => ({ id: item.id, kind: "evidence" as const, label: item.selectedText, detail: `${item.evidenceType} · ${item.stance}`, confidence: item.confidence, evidenceIds: [item.id] })),
    ...sources.map((source) => ({ id: source.id, kind: "source" as const, label: source.title, detail: `${source.sourceType} · ${source.evidenceIds.length} captured evidence`, evidenceIds: source.evidenceIds })),
    ...gaps.map((gap) => ({ id: gap.id, kind: "gap" as const, label: gap.topic, detail: `${gap.coverage}% coverage · ${gap.evidenceCount} evidence` })),
  ];
  const edges: GraphEdge[] = [
    ...claims.map((claim) => ({ id: `${questionId}:${claim.id}`, source: questionId, target: claim.id, relation: "related_to" as const })),
    ...dataset.claimRelations
      .filter((relation) => claimIds.has(relation.fromClaimId) && claimIds.has(relation.toClaimId))
      .map((relation) => ({
        id: relation.id,
        source: relation.fromClaimId,
        target: relation.toClaimId,
        relation: relation.type === "CONTRADICTS" ? "contradicts" as const : relation.type === "SUPPORTS" ? "supports" as const : relation.type === "DEPENDS_ON" ? "depends_on" as const : relation.type === "EXPANDS" ? "expands" as const : "related_to" as const,
      })),
    ...dataset.conflicts.flatMap((conflict) => {
      const supportingClaim = claims.find((claim) => claim.evidenceIds.some((id) => conflict.supportingEvidence.includes(id)));
      const contradictingClaim = claims.find((claim) => claim.evidenceIds.some((id) => conflict.contradictingEvidence.includes(id)));
      if (!supportingClaim || !contradictingClaim || supportingClaim.id === contradictingClaim.id) return [];
      if (dataset.claimRelations.some((relation) => relation.type === "CONTRADICTS" && new Set([relation.fromClaimId, relation.toClaimId]).has(supportingClaim.id) && new Set([relation.fromClaimId, relation.toClaimId]).has(contradictingClaim.id))) return [];
      return [{ id: `conflict:${conflict.id}`, source: supportingClaim.id, target: contradictingClaim.id, relation: "contradicts" as const }];
    }),
    ...claims.flatMap((claim) => claim.evidenceIds.filter((id) => evidenceIds.has(id)).map((id) => ({ id: `${id}:${claim.id}`, source: id, target: claim.id, relation: "supports" as const }))),
    ...sources.flatMap((source) => evidence.filter((item) => item.sourceId === source.id).map((item) => ({ id: `${source.id}:${item.id}`, source: source.id, target: item.id, relation: "supports" as const }))),
    ...gaps.flatMap((gap) => claims.filter((claim) => claim.topic === gap.topic).slice(0, 2).map((claim) => ({ id: `${claim.id}:${gap.id}`, source: claim.id, target: gap.id, relation: "depends_on" as const }))),
  ];
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  let connectedComponents = 0;
  const visited = new Set<string>();
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    connectedComponents += 1;
    const queue = [node.id];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...(adjacency.get(current) ?? []));
    }
  }
  const strongestConnectors = nodes
    .map((node) => ({ id: node.id, label: node.label, kind: node.kind, connections: adjacency.get(node.id)?.size ?? 0 }))
    .filter((node) => node.kind !== "question")
    .sort((left, right) => right.connections - left.connections)
    .slice(0, 5);
  const contradictionCount = edges.filter((edge) => edge.relation === "contradicts").length;
  const isolatedNodes = [...adjacency.values()].filter((connections) => connections.size === 0).length;
  const nodeKinds: GraphNode["kind"][] = ["question", "claim", "evidence", "source", "gap"];
  const relations: GraphEdge["relation"][] = ["supports", "contradicts", "expands", "related_to", "depends_on"];
  const findings = [
    contradictionCount ? `${contradictionCount} contradiction or contextual-tension link${contradictionCount === 1 ? "" : "s"} cross the current claim network.` : "No contradiction link is visible yet; leading claims still need deliberate counterevidence.",
    connectedComponents > 1 ? `The graph splits into ${connectedComponents} components, which suggests separate lines of inquiry have not yet been synthesized.` : "All visible nodes belong to one connected research structure.",
    isolatedNodes ? `${isolatedNodes} node${isolatedNodes === 1 ? " is" : "s are"} isolated and cannot currently influence the synthesis.` : "Every visible node has at least one traceable relationship.",
    strongestConnectors[0] ? `The strongest connector is “${strongestConnectors[0].label}” with ${strongestConnectors[0].connections} direct relationships; changes to it affect the widest part of the graph.` : "No bridge claim exists yet.",
  ];
  const nextActions = [
    ...(isolatedNodes ? ["Connect or remove isolated evidence before using it in the report."] : []),
    ...(contradictionCount ? ["Open Contradiction radar and compare method, population, outcome, and date for each opposing link."] : ["Search specifically for a null result or opposing finding for the leading claim."]),
    ...(connectedComponents > 1 ? ["Add a synthesis claim that explicitly explains whether the separate components reinforce, qualify, or contradict each other."] : []),
    "Add independent evidence to high-degree claims so the graph does not depend on one source.",
  ];
  const analysis: GraphAnalysis = {
    connectedComponents,
    isolatedNodes,
    contradictionCount,
    strongestConnectors,
    nodeDistribution: nodeKinds.map((kind) => ({ kind, count: nodes.filter((node) => node.kind === kind).length })),
    relationDistribution: relations.map((relation) => ({ relation, count: edges.filter((edge) => edge.relation === relation).length })),
    findings,
    nextActions,
  };
  return { nodes, edges, analysis };
}
