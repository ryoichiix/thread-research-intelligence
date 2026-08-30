export type EvidenceType =
  | "research paper"
  | "article"
  | "documentation"
  | "report"
  | "dataset"
  | "news"
  | "blog"
  | "opinion"
  | "unknown";

export type DocumentType =
  | "journal_article"
  | "conference_paper"
  | "preprint"
  | "thesis"
  | "book_chapter"
  | "technical_report"
  | "government_report"
  | "dataset"
  | "documentation"
  | "news_article"
  | "blog_post"
  | "webpage"
  | "pdf"
  | "unknown";

export type AuthenticityTier = "verified" | "strong" | "moderate" | "weak" | "unverified";

export interface SourceReference {
  text: string;
  url?: string;
  doi?: string;
}

export type Stance = "supports" | "contradicts" | "neutral" | "unclear";
export type ClaimRelationType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "EXPANDS"
  | "DEPENDS_ON"
  | "RELATED_TO"
  | "DUPLICATES";
export type ConflictStatus =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "PARTIALLY_SUPPORTED"
  | "TENSION"
  | "INCONCLUSIVE"
  | "UNRELATED";
export type ConflictResolutionChoice =
  | "supporting_position"
  | "contradicting_position"
  | "context_dependent"
  | "inconclusive";
export type InsightType =
  | "EMERGING_PATTERN"
  | "CONTRADICTION"
  | "KNOWLEDGE_GAP"
  | "SIGNIFICANT_FINDING"
  | "WEAK_EVIDENCE"
  | "NEW_CONNECTION";

export interface Project {
  id: string;
  ownerId: string | null;
  title: string;
  researchQuestion: string;
  description: string;
  tags: string[];
  evidenceTarget: number;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
}

export interface Source {
  id: string;
  projectId: string;
  title: string;
  url: string;
  domain: string;
  sourceType: EvidenceType;
  documentType: DocumentType;
  author: string;
  authors: string[];
  publicationDate: string;
  publisher: string;
  journal: string;
  doi: string;
  citationCount: number | null;
  referenceCount: number | null;
  citedByUrl: string;
  pdfUrl: string;
  citationText: string;
  metadataProvider: string;
  peerReviewStatus: "likely" | "unknown" | "not_applicable";
  authenticityScore: number;
  authenticityTier: AuthenticityTier;
  authenticitySignals: string[];
  references: SourceReference[];
  summary: string;
  limitations: string[];
  qualityScore: number;
  freshnessScore: number;
  evidenceIds: string[];
  claimIds: string[];
  discoveredAt: string;
  isDemo: boolean;
}

export interface Evidence {
  id: string;
  projectId: string;
  sourceId: string;
  selectedText: string;
  surroundingContext: string;
  pageTitle: string;
  url: string;
  author: string;
  publicationDate: string;
  capturedAt: string;
  evidenceType: EvidenceType;
  extractedClaim: string;
  summary: string;
  stance: Stance;
  confidence: number;
  methodology: string;
  limitations: string[];
  topic: string;
  isDemo: boolean;
}

export interface Claim {
  id: string;
  projectId: string;
  text: string;
  confidence: number;
  topic: string;
  entities: string[];
  evidenceIds: string[];
  isDemo: boolean;
}

export interface ClaimRelation {
  id: string;
  projectId: string;
  fromClaimId: string;
  toClaimId: string;
  type: ClaimRelationType;
  confidence: number;
  rationale: string;
}

export interface Insight {
  id: string;
  projectId: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  relatedClaims: string[];
  recommendedAction: string;
  createdAt: string;
  isDemo: boolean;
}

export interface ResearchGap {
  id: string;
  projectId: string;
  topic: string;
  coverage: number;
  evidenceCount: number;
  confidence: number;
  whyItMatters: string;
  reasons?: string[];
  missingDimensions?: string[];
  suggestedQuestions: string[];
  suggestedSearches: string[];
  isLargest: boolean;
  isDemo: boolean;
}

export interface ResearchTask {
  id: string;
  projectId: string;
  title: string;
  reason: string;
  expectedValue: "High" | "Medium" | "Low";
  evidenceAvailable: number;
  missingEvidence: string;
  suggestedSearches: string[];
  status: "recommended" | "investigating" | "complete";
  isDemo: boolean;
}

export interface Conflict {
  id: string;
  projectId: string;
  topic: string;
  title: string;
  status: ConflictStatus;
  severity: "major" | "moderate" | "minor";
  resolution: "resolved" | "unresolved";
  supportingEvidence: string[];
  contradictingEvidence: string[];
  explanation: string[];
  confidence: number;
  resolutionChoice?: ConflictResolutionChoice;
  resolutionRationale?: string;
  resolvedAt?: string;
  isDemo: boolean;
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  occurredAt: string;
  type:
    | "evidence_added"
    | "contradiction_detected"
    | "contradiction_resolved"
    | "claim_strengthened"
    | "confidence_reduced"
    | "pattern_discovered"
    | "gap_identified"
    | "task_generated";
  title: string;
  description: string;
  evidenceIds: string[];
  isDemo: boolean;
}

export interface GraphNode {
  id: string;
  kind: "question" | "claim" | "evidence" | "source" | "gap";
  label: string;
  detail: string;
  confidence?: number;
  evidenceIds?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: "supports" | "contradicts" | "expands" | "related_to" | "depends_on";
}

export interface GraphAnalysis {
  connectedComponents: number;
  isolatedNodes: number;
  contradictionCount: number;
  strongestConnectors: Array<{ id: string; label: string; kind: GraphNode["kind"]; connections: number }>;
  nodeDistribution: Array<{ kind: GraphNode["kind"]; count: number }>;
  relationDistribution: Array<{ relation: GraphEdge["relation"]; count: number }>;
  findings: string[];
  nextActions: string[];
}

export interface ResearchHealth {
  overall: number;
  completion: number;
  evidenceCoverage: number;
  sourceQuality: number;
  agreement: number;
  topicCoverage: number;
  recency: number;
  evidenceDepth: number;
  sourceDiversity: number;
  methodologicalRigor: number;
  contradictionTesting: number;
  citationCompleteness: number;
  aspectCoverage: number;
  stage: "not_started" | "exploratory" | "developing" | "substantial" | "near_review_ready" | "ready_for_review";
  isComplete: boolean;
  isPerfect: false;
  coveredAspects: number;
  totalAspects: number;
  missingAspects: string[];
  aspectAudit: Array<{
    key: string;
    label: string;
    score: number;
    status: "missing" | "thin" | "developing" | "covered";
    evidenceCount: number;
    sourceCount: number;
    whyItMatters: string;
  }>;
  completionGates: Array<{
    id: string;
    label: string;
    passed: boolean;
    current: string;
    requirement: string;
  }>;
  verdicts: {
    perfect: string;
    completed: string;
    coverage: string;
  };
}

export interface ResearchDataset {
  project: Project;
  sources: Source[];
  evidence: Evidence[];
  claims: Claim[];
  claimRelations: ClaimRelation[];
  insights: Insight[];
  gaps: ResearchGap[];
  tasks: ResearchTask[];
  conflicts: Conflict[];
  timeline: TimelineEvent[];
}

export interface DashboardSummary {
  project: Project;
  health: ResearchHealth;
  counts: {
    sources: number;
    evidence: number;
    claims: number;
    conflicts: number;
    gaps: number;
  };
  insights: Insight[];
  healthTrend: Array<{ label: string; score: number }>;
  evidenceGrowth: Array<{ label: string; evidence: number }>;
  stanceDistribution: Array<{ name: string; value: number }>;
  topicCoverage: Array<{ topic: string; coverage: number }>;
  sourceDistribution: Array<{ type: string; count: number }>;
}
