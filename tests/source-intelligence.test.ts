import { describe, expect, it } from "vitest";
import { classifyDocument, evidenceTypeForDocument, formatCitation, normalizeDoi } from "@/lib/analysis/source-intelligence";

describe("source intelligence", () => {
  it("normalizes DOI URLs and formats a stable citation", () => {
    expect(normalizeDoi("https://doi.org/10.1000/Test.42")).toBe("10.1000/test.42");
    expect(formatCitation({ title: "A useful study", url: "https://example.org/paper", authors: ["Ada Lovelace"], publicationDate: "2025/4/2", journal: "Journal of Tests", publisher: "", doi: "10.1000/test.42" })).toContain("https://doi.org/10.1000/test.42");
  });

  it("classifies scholarly and institutional documents", () => {
    expect(classifyDocument({ title: "Paper", url: "https://example.org/article", journal: "Science" })).toBe("journal_article");
    expect(classifyDocument({ title: "Annual report", url: "https://agency.gov/report" })).toBe("government_report");
    expect(evidenceTypeForDocument("conference_paper")).toBe("research paper");
  });
});
