import { z } from "zod";

export const evidenceTypeSchema = z.enum([
  "research paper",
  "article",
  "documentation",
  "report",
  "dataset",
  "news",
  "blog",
  "opinion",
  "unknown",
]);

export const documentTypeSchema = z.enum([
  "journal_article",
  "conference_paper",
  "preprint",
  "thesis",
  "book_chapter",
  "technical_report",
  "government_report",
  "dataset",
  "documentation",
  "news_article",
  "blog_post",
  "webpage",
  "pdf",
  "unknown",
]);

const sourceReferenceSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  url: z.url().optional(),
  doi: z.string().trim().max(200).optional(),
});

export const stanceSchema = z.enum(["supports", "contradicts", "neutral", "unclear"]);

export const projectInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  researchQuestion: z.string().trim().min(10).max(500),
  description: z.string().trim().max(1200).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

export const sourceInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  url: z.url(),
  sourceType: evidenceTypeSchema.default("unknown"),
  documentType: documentTypeSchema.default("unknown"),
  author: z.string().trim().max(160).default("Unknown author"),
  authors: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  publicationDate: z.string().trim().max(40).default(""),
  publisher: z.string().trim().max(300).default(""),
  journal: z.string().trim().max(300).default(""),
  doi: z.string().trim().max(200).default(""),
  citationCount: z.number().int().min(0).nullable().default(null),
  referenceCount: z.number().int().min(0).nullable().default(null),
  citedByUrl: z.url().or(z.literal("")).default(""),
  pdfUrl: z.url().or(z.literal("")).default(""),
  metadataProvider: z.string().trim().max(80).default("page"),
  references: z.array(sourceReferenceSchema).max(60).default([]),
  summary: z.string().trim().max(3000).default(""),
});

export const evidenceInputSchema = z.object({
  projectId: z.string().min(1),
  sourceId: z.string().optional(),
  selectedText: z.string().trim().min(8).max(12000),
  surroundingContext: z.string().trim().max(24000).default(""),
  pageTitle: z.string().trim().min(1).max(500),
  url: z.url(),
  author: z.string().trim().max(160).default("Unknown author"),
  publicationDate: z.string().trim().max(40).default(""),
  evidenceType: evidenceTypeSchema.default("unknown"),
  topic: z.string().trim().max(100).default("Unclassified"),
  documentType: documentTypeSchema.default("unknown"),
  authors: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  publisher: z.string().trim().max(300).default(""),
  journal: z.string().trim().max(300).default(""),
  doi: z.string().trim().max(200).default(""),
  citationCount: z.number().int().min(0).nullable().default(null),
  referenceCount: z.number().int().min(0).nullable().default(null),
  citedByUrl: z.url().or(z.literal("")).default(""),
  pdfUrl: z.url().or(z.literal("")).default(""),
  metadataProvider: z.string().trim().max(80).default("page"),
  references: z.array(sourceReferenceSchema).max(60).default([]),
});

export const verifyInputSchema = z.object({
  projectId: z.string().min(1),
  claim: z.string().trim().min(8).max(4000),
});

export const compareInputSchema = z.object({
  left: z.string().trim().min(8).max(4000),
  right: z.string().trim().min(8).max(4000),
  leftMethodology: z.string().trim().max(2000).optional(),
  rightMethodology: z.string().trim().max(2000).optional(),
});

export const comparisonOutputSchema = z.object({
  status: z.enum(["SUPPORTED", "CONTRADICTED", "PARTIALLY_SUPPORTED", "TENSION", "INCONCLUSIVE", "UNRELATED"]),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1).max(800),
});

export const conflictResolutionInputSchema = z.object({
  choice: z.enum(["supporting_position", "contradicting_position", "context_dependent", "inconclusive"]),
  rationale: z.string().trim().min(12).max(1200),
});

export const researchSearchInputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().trim().min(3).max(500),
});

export const searchDecisionInputSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(["saved", "rejected"]),
});

export const insightOutputSchema = z.object({
  type: z.enum([
    "EMERGING_PATTERN",
    "CONTRADICTION",
    "KNOWLEDGE_GAP",
    "SIGNIFICANT_FINDING",
    "WEAK_EVIDENCE",
    "NEW_CONNECTION",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1200),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(z.string()).min(1),
  contradictingEvidence: z.array(z.string()),
  relatedClaims: z.array(z.string()),
  recommendedAction: z.string().min(1).max(500),
});

export const evidenceAnalysisOutputSchema = z.object({
  extractedClaim: z.string().min(1).max(500),
  summary: z.string().min(1).max(800),
  stance: stanceSchema,
  confidence: z.number().min(0).max(1),
  methodology: z.string().max(800),
  limitations: z.array(z.string().max(400)).max(8),
  topic: z.string().min(1).max(100),
});

export const authInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
