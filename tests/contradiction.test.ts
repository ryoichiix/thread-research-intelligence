import { describe, expect, it } from "vitest";
import { classifyContradiction } from "@/lib/analysis/contradiction";

describe("contradiction classification", () => {
  it("classifies opposing significance statements as contradiction", () => {
    const result = classifyContradiction({
      left: "AI agents significantly improve developer productivity.",
      right: "No statistically significant productivity improvement was observed.",
    });
    expect(result.status).toBe("CONTRADICTED");
  });

  it("treats two positive but different percentages as tension", () => {
    const result = classifyContradiction({
      left: "AI agents improve task speed by 30%.",
      right: "AI agents improve task speed by 5%.",
    });
    expect(result.status).toBe("TENSION");
  });

  it("does not force unrelated claims into a conflict", () => {
    const result = classifyContradiction({
      left: "Agent latency increases review interruptions.",
      right: "Enterprise procurement contracts renew annually.",
    });
    expect(result.status).toBe("UNRELATED");
  });

  it("requires subject overlap before treating opposite language as a contradiction", () => {
    const result = classifyContradiction({
      left: "The intervention improves reading accuracy for primary-school students.",
      right: "The medication does not improve blood pressure in older adults.",
    });
    expect(result.status).toBe("UNRELATED");
  });

  it("detects opposing directions for the same outcome", () => {
    const result = classifyContradiction({
      left: "AI coding assistants increase developer task completion speed.",
      right: "AI coding assistants decrease developer task completion speed.",
    });
    expect(result.status).toBe("CONTRADICTED");
  });

  it("treats opposing findings from different methods as contextual tension", () => {
    const result = classifyContradiction({
      left: "AI coding assistants increase developer task completion speed.",
      right: "AI coding assistants decrease developer task completion speed.",
      leftMethodology: "Randomized trial with professional developers.",
      rightMethodology: "Self-reported survey of university students.",
    });
    expect(result.status).toBe("TENSION");
  });

  it("detects mutually exclusive categorical mechanisms", () => {
    const result = classifyContradiction({
      left: "AI agents adapt in real time by using online learning and feedback loops.",
      right: "AI agents adapt in real time by using offline learning and feedback loops.",
    });
    expect(result.status).toBe("CONTRADICTED");
    expect(result.explanation).toContain("online versus offline");
  });

  it("uses whole original words, not half-stemmed fragments, in explanations", () => {
    // Regression test: the shared-term list used to be built from canonicalToken() output
    // directly, which is a matching heuristic, not a real stemmer — "compared" was truncated
    // to "compar" and shown verbatim in contradiction explanations and exported reports.
    const result = classifyContradiction({
      left: "Remote engineers showed slower output compared to in-office peers.",
      right: "Remote engineers showed improved output compared to in-office peers.",
    });
    expect(result.explanation).not.toMatch(/\bcompar\b/);
    expect(result.explanation).toContain("compared");
  });
});
