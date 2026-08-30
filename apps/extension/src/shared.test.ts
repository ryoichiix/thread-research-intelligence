import { describe, expect, it } from "vitest";
import { readThreadJson } from "./api";
import { actionEndpoint, createEvidencePayload, selectionFingerprint } from "./shared";

describe("extension capture functionality", () => {
  it("maps selection provenance into the evidence API payload", () => {
    const payload = createEvidencePayload({
      selectedText: "AI assistance reduced completion time.",
      surroundingContext: "Study context",
      pageTitle: "Research page",
      url: "https://example.test/research",
      hostname: "example.test",
      author: "Researcher",
      authors: ["Researcher"],
      publicationDate: "2026-08-28",
      documentType: "journal_article",
      publisher: "Test Publisher",
      journal: "Journal of Tests",
      doi: "10.1000/test",
      citationCount: 4,
      referenceCount: 12,
      citedByUrl: "https://scholar.google.com/scholar?cites=1",
      pdfUrl: "https://example.test/research.pdf",
      metadataProvider: "scholarly_meta",
      references: [],
    }, "project-123");
    expect(payload.selectedText).toContain("reduced completion time");
    expect(payload.projectId).toBe("project-123");
    expect(payload.url).toBe("https://example.test/research");
  });

  it("routes all three context-menu actions to server endpoints", () => {
    expect(actionEndpoint("save")).toBe("/api/evidence");
    expect(actionEndpoint("explain")).toBe("/api/analyze/evidence");
    expect(actionEndpoint("verify")).toBe("/api/verify");
  });

  it("normalizes selection whitespace for duplicate protection", () => {
    expect(selectionFingerprint({ url: "https://example.test", selectedText: "A  useful\nclaim" }))
      .toBe("https://example.test::A useful claim");
  });

  it("turns a plain-text hosting rejection into a useful extension error", async () => {
    await expect(readThreadJson(new Response("Forbidden", { status: 403 })))
      .rejects.toThrow("Keep the matching THREAD website open and signed in");
  });

  it("parses valid JSON API responses", async () => {
    await expect(readThreadJson<{ ok: boolean }>(new Response('{"ok":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))).resolves.toEqual({ ok: true });
  });
});
