import OpenAI from "openai";
import type { Evidence, Insight, ResearchDataset } from "@thread/shared";
import { classifyContradiction } from "@/lib/analysis/contradiction";
import { extractClaimText } from "@/lib/analysis/claim-extraction";
import { comparisonOutputSchema, evidenceAnalysisOutputSchema, insightOutputSchema } from "@/lib/schemas";
import type { ClaimComparisonInput } from "@/lib/analysis/contradiction";

const canUseOpenAI = () => Boolean(process.env.OPENAI_API_KEY);

const allowedEvidenceIds = (candidate: string[], evidence: Evidence[]) => {
  const available = new Set(evidence.map((item) => item.id));
  return candidate.filter((id) => available.has(id));
};

export async function analyzeEvidence(
  input: Pick<Evidence, "selectedText" | "surroundingContext" | "evidenceType" | "topic">,
) {
  if (!canUseOpenAI()) {
    const claim = extractClaimText(input.selectedText);
    const comparisonText = input.selectedText.toLowerCase();
    const stance = /no significant|does not|failed to|slower|defect|risk/.test(comparisonText)
      ? "contradicts"
      : /improve|faster|reduce|gain|benefit/.test(comparisonText)
        ? "supports"
        : "neutral";
    return evidenceAnalysisOutputSchema.parse({
      extractedClaim: claim,
      summary: `The captured evidence makes a ${stance} claim about ${input.topic.toLowerCase() || "the research question"}.`,
      stance,
      confidence: 0.78,
      methodology: "Methodology not available in the captured excerpt.",
      limitations: ["Analysis is limited to the selected text and surrounding context."],
      topic: input.topic || "Unclassified",
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    store: false,
    instructions:
      "Analyze only the supplied research evidence. Do not invent sources or facts. Return a claim grounded in the quoted text.",
    input: JSON.stringify(input),
    text: {
      format: {
        type: "json_schema",
        name: "thread_evidence_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            extractedClaim: { type: "string" },
            summary: { type: "string" },
            stance: { type: "string", enum: ["supports", "contradicts", "neutral", "unclear"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            methodology: { type: "string" },
            limitations: { type: "array", items: { type: "string" } },
            topic: { type: "string" },
          },
          required: [
            "extractedClaim",
            "summary",
            "stance",
            "confidence",
            "methodology",
            "limitations",
            "topic",
          ],
        },
      },
    },
  });
  return evidenceAnalysisOutputSchema.parse(JSON.parse(response.output_text));
}

export async function generateInsight(dataset: ResearchDataset): Promise<Insight> {
  if (!canUseOpenAI()) {
    const evidence = dataset.evidence[0];
    if (!evidence) throw new Error("Capture evidence before generating an insight");
    return {
      id: crypto.randomUUID(),
      projectId: dataset.project.id,
      type: "SIGNIFICANT_FINDING",
      title: evidence.extractedClaim,
      description: evidence.summary,
      confidence: evidence.confidence,
      supportingEvidence: [evidence.id],
      contradictingEvidence: [],
      relatedClaims: dataset.claims.filter((claim) => claim.evidenceIds.includes(evidence.id)).map((claim) => claim.id),
      recommendedAction: "Capture additional independent evidence before treating this as a settled finding.",
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const evidence = dataset.evidence.slice(0, 30).map((item) => ({
    id: item.id,
    text: item.selectedText,
    stance: item.stance,
    topic: item.topic,
  }));
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    store: false,
    instructions:
      "Generate exactly one research insight. Every factual statement must be supported by one or more supplied evidence IDs. Never invent an ID.",
    input: JSON.stringify({ researchQuestion: dataset.project.researchQuestion, evidence }),
    text: {
      format: {
        type: "json_schema",
        name: "thread_insight",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "EMERGING_PATTERN",
                "CONTRADICTION",
                "KNOWLEDGE_GAP",
                "SIGNIFICANT_FINDING",
                "WEAK_EVIDENCE",
                "NEW_CONNECTION",
              ],
            },
            title: { type: "string" },
            description: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            supportingEvidence: { type: "array", items: { type: "string" }, minItems: 1 },
            contradictingEvidence: { type: "array", items: { type: "string" } },
            relatedClaims: { type: "array", items: { type: "string" } },
            recommendedAction: { type: "string" },
          },
          required: [
            "type",
            "title",
            "description",
            "confidence",
            "supportingEvidence",
            "contradictingEvidence",
            "relatedClaims",
            "recommendedAction",
          ],
        },
      },
    },
  });
  const parsed = insightOutputSchema.parse(JSON.parse(response.output_text));
  const supportingEvidence = allowedEvidenceIds(parsed.supportingEvidence, dataset.evidence);
  if (supportingEvidence.length === 0) throw new Error("Insight did not include valid evidence provenance");
  return {
    ...parsed,
    supportingEvidence,
    contradictingEvidence: allowedEvidenceIds(parsed.contradictingEvidence, dataset.evidence),
    relatedClaims: parsed.relatedClaims.filter((id) => dataset.claims.some((claim) => claim.id === id)),
    id: crypto.randomUUID(),
    projectId: dataset.project.id,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
}

export async function compareResearchClaims(input: ClaimComparisonInput) {
  if (!canUseOpenAI()) return classifyContradiction(input);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    store: false,
    instructions: "Compare two research claims. First verify they concern the same subject, population, intervention/exposure, and outcome. Distinguish direct contradiction from different methods, populations, magnitudes, or causal strength. Do not invent context.",
    input: JSON.stringify(input),
    text: {
      format: {
        type: "json_schema",
        name: "thread_claim_comparison",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["SUPPORTED", "CONTRADICTED", "PARTIALLY_SUPPORTED", "TENSION", "INCONCLUSIVE", "UNRELATED"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            explanation: { type: "string" },
          },
          required: ["status", "confidence", "explanation"],
        },
      },
    },
  });
  return comparisonOutputSchema.parse(JSON.parse(response.output_text));
}

export async function verifyAgainstResearch(claim: string, dataset: ResearchDataset) {
  const comparisons = await Promise.all(dataset.evidence.map(async (item) => ({
    item,
    comparison: await compareResearchClaims({ left: claim, right: item.extractedClaim, rightMethodology: item.methodology }),
  })));
  const relevant = comparisons.filter((entry) => entry.comparison.status !== "UNRELATED");
  const supporting = relevant.filter((entry) => entry.comparison.status === "SUPPORTED");
  const contradicting = relevant.filter((entry) => entry.comparison.status === "CONTRADICTED");
  const inconclusive = relevant.filter((entry) =>
    ["INCONCLUSIVE", "TENSION", "PARTIALLY_SUPPORTED"].includes(entry.comparison.status),
  );
  const strongestConflict = [...contradicting].sort(
    (a, b) => b.comparison.confidence - a.comparison.confidence,
  )[0];
  return {
    status: contradicting.length > 0 ? "POTENTIAL_CONFLICT" : supporting.length > 0 ? "SUPPORTED" : "INCONCLUSIVE",
    counts: {
      supporting: supporting.length,
      contradicting: contradicting.length,
      inconclusive: inconclusive.length,
    },
    strongestConflict: strongestConflict
      ? {
          evidenceId: strongestConflict.item.id,
          sourceId: strongestConflict.item.sourceId,
          text: strongestConflict.item.selectedText,
          explanation: strongestConflict.comparison.explanation,
        }
      : null,
    relatedEvidence: relevant.slice(0, 5).map((entry) => entry.item),
    isDemo: dataset.project.isDemo,
  };
}
