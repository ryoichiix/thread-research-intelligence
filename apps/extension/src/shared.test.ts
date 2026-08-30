import { describe, expect, it } from "vitest";
import { readThreadJson } from "./api";
import { MIN_SELECTION_LENGTH, actionEndpoint, createEvidencePayload, resolveSelectedText, selectionFingerprint } from "./shared";

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

describe("selection resolution", () => {
  /*
   * The regression this pins: the injected page script used to echo the string handed to
   * pageContext() straight back as selectedText. The side-panel buttons ("Save selected
   * evidence" / "Explain selection" / "Verify selection") send no text at all, so selectedText
   * was always "" and runAction's length guard rejected every click, while the context-menu
   * path kept working because it supplies info.selectionText.
   */
  it("uses the live page selection even when the caller passes nothing", () => {
    expect(resolveSelectedText("Remote work raised throughput by 18%.", "")).toBe("Remote work raised throughput by 18%.");
  });

  it("keeps the caller's text when the page reports no live selection", () => {
    expect(resolveSelectedText("", "Context menu captured this claim.")).toBe("Context menu captured this claim.");
  });

  it("prefers a substantial live selection over the caller's text", () => {
    expect(resolveSelectedText("The live selection on the page.", "Stale text.")).toBe("The live selection on the page.");
  });

  it("falls back to the caller's text when the live selection is too short to act on", () => {
    expect(resolveSelectedText("see", "Context menu captured this claim.")).toBe("Context menu captured this claim.");
  });

  it("collapses whitespace so the length guard measures real characters", () => {
    expect(resolveSelectedText("  Remote   work\n raised throughput.  ", "")).toBe("Remote work raised throughput.");
  });

  it("returns an empty string when neither source has a selection", () => {
    expect(resolveSelectedText(undefined, undefined)).toBe("");
    expect(resolveSelectedText(null, null)).toBe("");
  });

  it("only accepts a live selection at or above the shared minimum length", () => {
    const belowMinimum = "a".repeat(MIN_SELECTION_LENGTH - 1);
    const atMinimum = "a".repeat(MIN_SELECTION_LENGTH);
    expect(resolveSelectedText(belowMinimum, "caller text")).toBe("caller text");
    expect(resolveSelectedText(atMinimum, "caller text")).toBe(atMinimum);
  });
});
