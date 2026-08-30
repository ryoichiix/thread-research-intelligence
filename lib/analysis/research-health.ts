import type { ResearchDataset, ResearchHealth } from "@thread/shared";

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const safeText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const meaningful = (value: string, unavailable: RegExp) => safeText(value).length >= 18 && !unavailable.test(value);
const cap = (value: number, maximum = 95) => Math.min(maximum, Math.max(0, Math.round(value)));
const unique = (values: string[]) => new Set(values.map(safeText).filter(Boolean).map((value) => value.toLowerCase())).size;

const aspects = [
  { key: "scope", label: "Background and scope", pattern: /\b(background|context|definition|scope|prior work|literature|framework)\b/i, whyItMatters: "Defines what the question includes, excludes, and builds upon." },
  { key: "population", label: "Population, sample, or setting", pattern: /\b(participant|sample|population|cohort|dataset|patient|student|child|adult|user|country|setting|age|gender)\b/i, whyItMatters: "Shows who or what the findings actually describe." },
  { key: "method", label: "Methods and research design", pattern: /\b(method|methodology|experiment|survey|interview|trial|procedure|protocol|architecture|training|measure|instrument)\b/i, whyItMatters: "Makes the route from question to evidence inspectable." },
  { key: "outcomes", label: "Outcomes and findings", pattern: /\b(result|outcome|finding|effect|accuracy|performance|association|increase|decrease|improv|observed)\w*/i, whyItMatters: "Connects the research question to explicit observed outcomes." },
  { key: "uncertainty", label: "Uncertainty and statistical strength", pattern: /\b(confidence interval|effect size|standard deviation|variance|uncertain|error rate|statistical|significan|sample size)\w*|\bp\s*[<=>]|\bn\s*=\s*\d+/i, whyItMatters: "Separates measured strength and uncertainty from confident wording." },
  { key: "mechanism", label: "Mechanisms and theory", pattern: /\b(mechanism|theory|causal|cause|mediate|explain|process|hypothesis|because)\w*/i, whyItMatters: "Tests why a relationship may exist, not only whether it appears." },
  { key: "alternatives", label: "Alternatives and confounders", pattern: /\b(confound|alternative explanation|control group|baseline|selection bias|reverse caus|correlation|rival|counterfactual)\w*/i, whyItMatters: "Checks whether another explanation can account for the result." },
  { key: "limitations", label: "Limitations and bias", pattern: /\b(limitation|constraint|weakness|caveat|bias|cannot|future work|shortcoming)\w*/i, whyItMatters: "Prevents local or fragile findings from being presented as universal." },
  { key: "counterevidence", label: "Contradictions and counterevidence", pattern: /\b(contradict|conflict|counterevidence|in contrast|whereas|however|fails? to|no effect|mixed evidence)\b/i, whyItMatters: "Actively tests the leading explanation against opposing evidence." },
  { key: "implications", label: "Generalizability and implications", pattern: /\b(generali[sz]|external validity|implication|applicab|transfer|future research|policy|practice)\w*/i, whyItMatters: "Defines where conclusions may transfer and what follows from them." },
] as const;

export function calculateTopicCoverage(input: { evidenceCount: number; sourceCount: number; methodCount?: number }) {
  const evidenceBreadth = Math.min(1, input.evidenceCount / 10);
  const sourceBreadth = Math.min(1, input.sourceCount / 6);
  const methodBreadth = Math.min(1, (input.methodCount ?? 0) / 4);
  return cap(evidenceBreadth * 30 + sourceBreadth * 50 + methodBreadth * 20);
}

export function calculateResearchHealth(dataset: ResearchDataset): ResearchHealth {
  const targetEvidence = Math.max(dataset.project.evidenceTarget, 15);
  const targetSources = Math.max(8, Math.ceil(targetEvidence / 2));
  const sourceByEvidence = new Map(dataset.evidence.map((item) => [item.id, item.sourceId]));
  const corroboratedClaims = dataset.claims.filter((claim) => unique(claim.evidenceIds.map((id) => sourceByEvidence.get(id) ?? "")) >= 2).length;
  const evidenceDepth = cap(
    Math.min(1, dataset.evidence.length / targetEvidence) * 35 +
      Math.min(1, dataset.sources.length / targetSources) * 40 +
      (dataset.claims.length ? corroboratedClaims / dataset.claims.length : 0) * 25,
  );

  const sourceQualityBase = average(dataset.sources.map((source) => (source.qualityScore + source.authenticityScore) / 2));
  const sourceSampleConfidence = Math.min(1, dataset.sources.length / 6);
  const sourceQuality = cap(sourceQualityBase * (0.45 + sourceSampleConfidence * 0.55));
  const sourceDiversity = cap(
    Math.min(1, unique(dataset.sources.map((source) => source.domain)) / 5) * 35 +
      Math.min(1, unique(dataset.sources.map((source) => source.documentType)) / 3) * 20 +
      Math.min(1, unique(dataset.sources.flatMap((source) => source.authors.length ? source.authors : [source.author])) / 6) * 25 +
      Math.min(1, dataset.sources.length / targetSources) * 20,
  );

  const methodEvidence = dataset.evidence.filter((item) => meaningful(item.methodology, /not available|unavailable|unknown/i));
  const limitationEvidence = dataset.evidence.filter((item) => item.limitations.some((value) => meaningful(value, /not available|unavailable|unknown/i)));
  const researchSources = dataset.sources.filter((source) => ["journal_article", "conference_paper", "preprint", "thesis", "technical_report", "government_report", "dataset"].includes(source.documentType));
  const methodologicalRigor = cap(
    (dataset.evidence.length ? methodEvidence.length / dataset.evidence.length : 0) * 45 +
      (dataset.evidence.length ? limitationEvidence.length / dataset.evidence.length : 0) * 25 +
      (dataset.sources.length ? researchSources.length / dataset.sources.length : 0) * 15 +
      Math.min(1, methodEvidence.length / 6) * 15,
  );

  const claimPairs = dataset.claims.length > 1 ? (dataset.claims.length * (dataset.claims.length - 1)) / 2 : 0;
  const comparisonTarget = Math.max(3, Math.min(12, claimPairs));
  const comparedRelations = unique(dataset.claimRelations.map((relation) => [relation.fromClaimId, relation.toClaimId].sort().join(":")));
  const counterEvidencePresent = dataset.conflicts.length > 0 || dataset.claimRelations.some((relation) => relation.type === "CONTRADICTS");
  const contradictionTesting = cap(
    Math.min(1, comparedRelations / comparisonTarget) * 65 +
      Math.min(1, dataset.sources.length / 6) * 20 +
      (counterEvidencePresent ? 15 : 0),
  );

  const citationCompletenessBase = average(dataset.sources.map((source) => {
    const checks = [source.title, source.author, source.publicationDate, source.citationText, source.doi || source.publisher || source.journal];
    return (checks.filter((value) => safeText(value).length > 0 && !/unknown|unavailable/i.test(safeText(value))).length / checks.length) * 100;
  }));
  const citationCompleteness = cap(citationCompletenessBase * (0.55 + Math.min(1, dataset.sources.length / 6) * 0.45));
  const recency = cap(average(dataset.sources.map((source) => source.freshnessScore)) * (0.6 + Math.min(1, dataset.sources.length / 5) * 0.4));

  const evidenceText = dataset.evidence.map((item) => `${item.selectedText} ${item.surroundingContext} ${item.summary} ${item.methodology} ${item.limitations.join(" ")}`);
  const aspectAudit = aspects.map((aspect) => {
    const matching = dataset.evidence.filter((_, index) => aspect.pattern.test(evidenceText[index]));
    const sources = unique(matching.map((item) => item.sourceId));
    let score = cap(Math.min(1, matching.length / 6) * 35 + Math.min(1, sources / 5) * 55);
    if (aspect.key === "scope" && safeText(dataset.project.description).length >= 80) score = cap(score + 10);
    if (aspect.key === "counterevidence") score = Math.max(score, contradictionTesting);
    const status = score >= 70 ? "covered" : score >= 40 ? "developing" : score > 0 ? "thin" : "missing";
    return { key: aspect.key, label: aspect.label, score, status, evidenceCount: matching.length, sourceCount: sources, whyItMatters: aspect.whyItMatters } as const;
  });
  const aspectCoverage = cap(average(aspectAudit.map((aspect) => aspect.score)));
  const coveredAspects = aspectAudit.filter((aspect) => aspect.status === "covered").length;
  const missingAspects = aspectAudit.filter((aspect) => aspect.status === "missing" || aspect.status === "thin").map((aspect) => aspect.label);

  const scopeDefined = safeText(dataset.project.researchQuestion).length >= 20 && safeText(dataset.project.description).length >= 80;
  const supportedSynthesis = dataset.claims.length >= 5 && corroboratedClaims / dataset.claims.length >= 0.7;
  const completionGates = [
    { id: "scope", label: "Question and scope are explicitly defined", passed: scopeDefined, current: safeText(dataset.project.description) ? `${safeText(dataset.project.description).length} description characters` : "No project scope description", requirement: "Research question plus a scope description of at least 80 characters" },
    { id: "sources", label: "Independent source base is broad enough", passed: dataset.sources.length >= targetSources, current: `${dataset.sources.length} sources`, requirement: `At least ${targetSources} independent sources` },
    { id: "evidence", label: "Evidence volume reaches the research target", passed: dataset.evidence.length >= targetEvidence, current: `${dataset.evidence.length} evidence units`, requirement: `At least ${targetEvidence} evidence units` },
    { id: "aspects", label: "All core aspects are substantively covered", passed: aspectCoverage >= 75 && missingAspects.length === 0, current: `${coveredAspects}/${aspects.length} aspects covered`, requirement: "At least 75% aspect coverage with no missing or thin aspect" },
    { id: "diversity", label: "Sources are diverse and independent", passed: sourceDiversity >= 70, current: `${sourceDiversity}/100 diversity`, requirement: "At least 70/100 across domains, document types, and authors" },
    { id: "methods", label: "Methods and limitations are documented", passed: methodologicalRigor >= 70, current: `${methodologicalRigor}/100 methodological rigor`, requirement: "At least 70/100 with methods and limitations captured" },
    { id: "contradictions", label: "Leading claims have been stress-tested", passed: contradictionTesting >= 60 && dataset.claimRelations.length >= 3, current: `${contradictionTesting}/100 across ${dataset.claimRelations.length} comparisons`, requirement: "At least 60/100 and three explicit claim comparisons" },
    { id: "citations", label: "Bibliographic provenance is complete", passed: citationCompleteness >= 80, current: `${citationCompleteness}/100 citation completeness`, requirement: "At least 80/100 citation completeness" },
    { id: "synthesis", label: "Conclusions have independent corroboration", passed: supportedSynthesis, current: `${corroboratedClaims}/${dataset.claims.length} claims independently corroborated`, requirement: "At least five claims, with 70% supported by two or more sources" },
    { id: "conflicts", label: "No major contradiction is left unresolved", passed: contradictionTesting >= 60 && !dataset.conflicts.some((conflict) => conflict.severity === "major" && conflict.resolution === "unresolved"), current: `${dataset.conflicts.filter((conflict) => conflict.resolution === "unresolved").length} unresolved conflicts`, requirement: "Contradiction review completed and no unresolved major conflict" },
  ];
  const isComplete = completionGates.every((gate) => gate.passed);
  const weighted = evidenceDepth * 0.2 + sourceQuality * 0.1 + sourceDiversity * 0.12 + methodologicalRigor * 0.14 + contradictionTesting * 0.12 + citationCompleteness * 0.1 + aspectCoverage * 0.22;
  const bottleneck = Math.min(evidenceDepth, aspectCoverage, methodologicalRigor, contradictionTesting);
  let overall = dataset.evidence.length ? cap(weighted * 0.78 + bottleneck * 0.22) : 0;
  if (dataset.sources.length < 3) overall = Math.min(overall, 35);
  if (dataset.evidence.length < 5) overall = Math.min(overall, 40);
  if (!isComplete) overall = Math.min(overall, 89);
  const completion = isComplete ? 100 : cap(overall * 0.75 + (completionGates.filter((gate) => gate.passed).length / completionGates.length) * 25, 89);
  const stage = dataset.evidence.length === 0 ? "not_started" : isComplete ? "ready_for_review" : overall >= 75 ? "near_review_ready" : overall >= 58 ? "substantial" : overall >= 35 ? "developing" : "exploratory";
  const failedGateCount = completionGates.filter((gate) => !gate.passed).length;
  const coverageVerdict = `${coveredAspects}/${aspects.length} core aspects are substantively covered${missingAspects.length ? `; missing or thin: ${missingAspects.slice(0, 4).join(", ")}${missingAspects.length > 4 ? ", and more" : ""}.` : "."}`;

  return {
    overall,
    completion,
    evidenceCoverage: evidenceDepth,
    sourceQuality,
    agreement: contradictionTesting,
    topicCoverage: aspectCoverage,
    recency,
    evidenceDepth,
    sourceDiversity,
    methodologicalRigor,
    contradictionTesting,
    citationCompleteness,
    aspectCoverage,
    stage,
    isComplete,
    isPerfect: false,
    coveredAspects,
    totalAspects: aspects.length,
    missingAspects,
    aspectAudit,
    completionGates,
    verdicts: {
      perfect: "No. Research can be defensible and review-ready, but it is never guaranteed perfect or final.",
      completed: isComplete ? "Yes - every current readiness gate is satisfied. Expert review is still required." : `No - ${failedGateCount} of ${completionGates.length} readiness gates still need work.`,
      coverage: coverageVerdict,
    },
  };
}
