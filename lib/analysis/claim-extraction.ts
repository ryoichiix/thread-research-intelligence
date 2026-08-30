import type { Evidence } from "@thread/shared";

const LEAD_INS = [
  /^the (study|report|analysis|authors?) (found|concluded|observed|showed|reported) that\s+/i,
  /^(results|findings|evidence) (show|shows|suggest|suggests|indicate|indicates) that\s+/i,
  /^according to the (study|report),?\s+/i,
];

export function extractClaimText(selectedText: string): string {
  const compact = selectedText.replace(/\s+/g, " ").trim();
  const sentence = compact.split(/(?<=[.!?])\s+/)[0] ?? compact;
  const stripped = LEAD_INS.reduce((value, pattern) => value.replace(pattern, ""), sentence);
  return stripped.length > 220 ? `${stripped.slice(0, 217)}…` : stripped;
}

// Common sentence-initial capitalized words that are not proper nouns on their own (only
// filtered when they appear as a single word, so e.g. "The Chinese Experiment" still counts).
const NON_ENTITY_LEAD_WORDS = new Set([
  "The", "This", "That", "These", "Those", "A", "An", "In", "On", "At", "By", "For",
  "Our", "We", "It", "According", "After", "Before", "During", "While", "Although",
]);

// Lightweight, dependency-free proper-noun heuristic for the no-AI fallback path: capture
// capitalized word sequences (candidate organizations, named studies, places, people) from the
// evidence text itself, rather than fabricating unrelated placeholder values. This intentionally
// stays simple — it is a fallback for when OPENAI_API_KEY is not configured, not a full NER model.
export function extractEntities(text: string): string[] {
  const candidates = text.match(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*)*\b/g) ?? [];
  const seen = new Set<string>();
  const entities: string[] = [];
  for (const candidate of candidates) {
    // A capitalized run can start with a filler word purely because it sits at the start of a
    // sentence (e.g. "The Harvard Business Review..."). Drop only that leading filler word, not
    // the whole match, so the real multi-word name is still captured.
    const words = candidate.trim().split(/\s+/);
    if (words.length > 1 && NON_ENTITY_LEAD_WORDS.has(words[0]!)) words.shift();
    const trimmed = words.join(" ");
    if (trimmed.length < 3) continue;
    if (words.length === 1 && NON_ENTITY_LEAD_WORDS.has(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push(trimmed);
    if (entities.length >= 6) break;
  }
  return entities;
}

export function createEvidenceClaim(evidence: Evidence) {
  return {
    id: crypto.randomUUID(),
    projectId: evidence.projectId,
    text: extractClaimText(evidence.selectedText),
    confidence: Math.min(0.96, Math.max(0.45, evidence.confidence)),
    topic: evidence.topic || "Unclassified",
    entities: extractEntities(evidence.selectedText),
    evidenceIds: [evidence.id],
    isDemo: evidence.isDemo,
  };
}
