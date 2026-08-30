import { describe, expect, it } from "vitest";
import type { Evidence } from "@thread/shared";
import { createEvidenceClaim, extractClaimText, extractEntities } from "@/lib/analysis/claim-extraction";

describe("claim extraction", () => {
  it("removes reporting lead-ins and keeps the grounded sentence", () => {
    expect(
      extractClaimText(
        "The study found that developers completed bounded tasks 18% faster with AI assistance. A second sentence adds context.",
      ),
    ).toBe("developers completed bounded tasks 18% faster with AI assistance.");
  });

  it("normalizes whitespace and caps unusually long selections", () => {
    const result = extractClaimText(`Results show that ${"verification time matters ".repeat(20)}`);
    expect(result.length).toBeLessThanOrEqual(220);
    expect(result.endsWith("…")).toBe(true);
  });

  it("creates database-compatible UUID claim identifiers", () => {
    const claim = createEvidenceClaim({
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      selectedText: "AI automation can reduce repetitive manual work.",
      confidence: 0.8,
      topic: "AI automation",
      isDemo: false,
    } as Evidence);

    expect(claim.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("derives entities from the evidence text instead of a fixed placeholder", () => {
    // Regression test: entities used to be hardcoded to ["AI coding agents", "developers"]
    // for every single claim, regardless of what the evidence was actually about.
    const claim = createEvidenceClaim({
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      selectedText: "Nicholas Bloom and the Quarterly Journal of Economics reported a 13% productivity gain.",
      confidence: 0.8,
      topic: "Productivity",
      isDemo: false,
    } as Evidence);

    expect(claim.entities).not.toEqual(["AI coding agents", "developers"]);
    expect(claim.entities).toContain("Nicholas Bloom");
  });

  it("extractEntities skips bare sentence-starter words but keeps real multi-word names", () => {
    const entities = extractEntities("The Harvard Business Review interviewed junior engineers about onboarding.");
    expect(entities).not.toContain("The");
    expect(entities).toContain("Harvard Business Review");
  });
});
