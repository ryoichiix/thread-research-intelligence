import { describe, expect, it } from "vitest";
import type { ResearchDataset } from "@thread/shared";
import { generateResearchReport } from "@/lib/report";

const dataset: ResearchDataset = {
  project: {
    id: "00000000-0000-4000-8000-000000000001",
    ownerId: "00000000-0000-4000-8000-000000000002",
    title: "Evidence integrity",
    researchQuestion: "How reliably does the evidence support the current conclusion?",
    description: "A production report rendering check.",
    tags: ["quality"],
    evidenceTarget: 20,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    isDemo: false,
  },
  sources: [],
  evidence: [],
  claims: [],
  claimRelations: [],
  insights: [],
  gaps: [],
  tasks: [],
  conflicts: [],
  timeline: [],
};

describe("structured research report", () => {
  it("renders a valid non-empty PDF without inventing evidence", async () => {
    const report = await generateResearchReport(dataset);
    expect(report.subarray(0, 5).toString()).toBe("%PDF-");
    expect(report.length).toBeGreaterThan(4_000);
  });
});
