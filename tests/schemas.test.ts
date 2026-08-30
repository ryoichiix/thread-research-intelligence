import { describe, expect, it } from "vitest";
import { evidenceInputSchema, insightOutputSchema, projectInputSchema } from "@/lib/schemas";

describe("API validation", () => {
  it("rejects an underspecified research question", () => {
    expect(projectInputSchema.safeParse({ title: "A project", researchQuestion: "AI?" }).success).toBe(false);
  });

  it("rejects malformed evidence URLs", () => {
    expect(evidenceInputSchema.safeParse({ projectId: "p", selectedText: "This is enough evidence text", pageTitle: "Page", url: "not-a-url" }).success).toBe(false);
  });

  it("requires insight provenance", () => {
    expect(insightOutputSchema.safeParse({ type: "EMERGING_PATTERN", title: "Pattern", description: "Description", confidence: 0.8, supportingEvidence: [], contradictingEvidence: [], relatedClaims: [], recommendedAction: "Investigate" }).success).toBe(false);
  });
});
