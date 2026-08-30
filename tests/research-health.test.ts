import { describe, expect, it } from "vitest";
import type { ResearchDataset } from "@thread/shared";
import { calculateResearchHealth, calculateTopicCoverage } from "@/lib/analysis/research-health";

const emptyDataset = (): ResearchDataset => ({
  project: { id: "project-1", ownerId: "user-1", title: "Research", researchQuestion: "What does the evidence show?", description: "", tags: [], evidenceTarget: 10, createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z", isDemo: false },
  sources: [], evidence: [], claims: [], claimRelations: [], insights: [], gaps: [], tasks: [], conflicts: [], timeline: [],
});

describe("research health", () => {
  it("starts at zero for a new production workspace", () => {
    const health = calculateResearchHealth(emptyDataset());
    expect(health).toMatchObject({ overall: 0, completion: 0, evidenceDepth: 0, aspectCoverage: 0, stage: "not_started", isComplete: false, isPerfect: false });
    expect(health.coveredAspects).toBe(0);
    expect(health.completionGates.every((gate) => !gate.passed)).toBe(true);
  });

  it("does not mark a handful of paragraphs as complete", () => {
    const dataset = emptyDataset();
    dataset.evidence = Array.from({ length: 5 }, (_, index) => ({ id: `evidence-${index}`, projectId: dataset.project.id, sourceId: "source-1", selectedText: "Observed result", surroundingContext: "Study context", pageTitle: "Study", url: "https://example.test/study", author: "Author", publicationDate: "2026-08-28", capturedAt: "2026-08-28T00:00:00.000Z", evidenceType: "research paper", extractedClaim: "Observed result", summary: "Observed result", stance: "supports", confidence: 0.8, methodology: "Study", limitations: [], topic: "Topic", isDemo: false }));
    const health = calculateResearchHealth(dataset);
    expect(health.evidenceDepth).toBeLessThan(50);
    expect(health.overall).toBeLessThan(50);
    expect(health.isComplete).toBe(false);
    expect(health.aspectAudit.some((aspect) => aspect.status === "missing")).toBe(true);
  });

  it("requires independent sources and methods before topic coverage can become high", () => {
    expect(calculateTopicCoverage({ evidenceCount: 3, sourceCount: 1, methodCount: 0 })).toBeLessThan(30);
    expect(calculateTopicCoverage({ evidenceCount: 10, sourceCount: 6, methodCount: 4 })).toBe(95);
  });
});
