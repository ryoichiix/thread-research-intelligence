import type { ConflictStatus } from "@thread/shared";

export interface ClaimComparisonInput {
  left: string;
  right: string;
  leftMethodology?: string;
  rightMethodology?: string;
}

export interface ClaimComparison {
  status: ConflictStatus;
  confidence: number;
  explanation: string;
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9%._ ]/g, " ").replace(/\s+/g, " ").trim();
const stopWords = new Set(["about", "after", "against", "among", "because", "before", "being", "between", "could", "during", "evidence", "finding", "findings", "from", "have", "into", "more", "most", "observed", "paper", "report", "research", "results", "showed", "shows", "study", "than", "that", "their", "there", "these", "this", "those", "under", "using", "were", "which", "with", "would"]);
const canonicalToken = (word: string) => {
  if (word.startsWith("improv")) return "improve";
  if (word.startsWith("signific")) return "significant";
  if (word.startsWith("productiv")) return "productivity";
  if (word.startsWith("associat")) return "associate";
  if (word.startsWith("develop")) return "developer";
  return word.replace(/(?:ing|ed|es|s)$/i, "");
};
// Keep both the canonical (stemmed) form used for matching and the original surface word used
// for display. Using the canonical form directly in user-facing explanations produced broken
// half-stemmed text (e.g. "compared" -> "compar"), since the suffix-stripping fallback in
// canonicalToken() is a matching heuristic, not a real stemmer.
const tokenizeWithDisplay = (text: string) =>
  normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .map((word) => ({ canonical: canonicalToken(word), display: word }));
const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const negations = ["no significant", "no statistically significant", "not significant", "does not", "did not", "do not", "failed to", "no evidence", "not associated", "no association", "ineffective", "without improvement"];
const positive = ["improve", "benefit", "effective", "faster", "gain", "higher accuracy", "increase productivity", "reduce time", "reduce error", "reduce risk", "lower mortality"];
const negative = ["worsen", "harm", "slower", "ineffective", "decrease productivity", "lower accuracy", "increase error", "increase risk", "higher mortality", "benefits disappear"];
const upward = ["increase", "higher", "raise", "rise", "grow", "more likely"];
const downward = ["decrease", "lower", "reduce", "decline", "drop", "less likely"];
const hedges = ["may", "might", "can", "could", "suggest", "possibly", "associated with"];
const categoricalOpposites = [
  ["online", "offline"],
  ["centralized", "decentralized"],
  ["synchronous", "asynchronous"],
  ["supervised", "unsupervised"],
  ["deterministic", "stochastic"],
  ["short term", "long term"],
  ["human led", "autonomous"],
] as const;

function overlapScore(left: string, right: string) {
  const leftTokens = tokenizeWithDisplay(left);
  const rightTokens = tokenizeWithDisplay(right);
  // Display form is taken from the left claim's original wording, keyed by canonical form so
  // "improved"/"improves"/"improving" all still count as one shared concept for scoring.
  const leftDisplayByCanonical = new Map(leftTokens.map(({ canonical, display }) => [canonical, display]));
  const leftWords = new Set(leftTokens.map((token) => token.canonical));
  const rightWords = new Set(rightTokens.map((token) => token.canonical));
  const sharedCanonical = [...leftWords].filter((word) => rightWords.has(word));
  const shared = sharedCanonical.map((canonical) => leftDisplayByCanonical.get(canonical)!);
  return { score: sharedCanonical.length / Math.max(Math.min(leftWords.size, rightWords.size), 1), shared };
}

function polarity(text: string) {
  if (hasAny(text, negations) || hasAny(text, negative)) return -1;
  if (hasAny(text, positive)) return 1;
  return 0;
}

function direction(text: string) {
  if (hasAny(text, negations)) return "none";
  if (hasAny(text, upward)) return "up";
  if (hasAny(text, downward)) return "down";
  return "unknown";
}

export function classifyContradiction(input: ClaimComparisonInput): ClaimComparison {
  const left = normalize(input.left);
  const right = normalize(input.right);
  const overlap = overlapScore(left, right);
  const methodOverlap = input.leftMethodology && input.rightMethodology ? overlapScore(input.leftMethodology, input.rightMethodology).score : 1;
  const leftNumbers = left.match(/\d+(?:\.\d+)?%/g) ?? [];
  const rightNumbers = right.match(/\d+(?:\.\d+)?%/g) ?? [];

  if (overlap.score < 0.18 || overlap.shared.length < 2) {
    return {
      status: "UNRELATED",
      confidence: 0.9,
      explanation: "The claims do not share enough subject and outcome terms for a defensible comparison.",
    };
  }

  const leftPolarity = polarity(left);
  const rightPolarity = polarity(right);
  const leftDirection = direction(left);
  const rightDirection = direction(right);
  const opposingDirection = (leftDirection === "up" && rightDirection === "down") || (leftDirection === "down" && rightDirection === "up") || (leftDirection === "none" && rightDirection !== "none" && rightDirection !== "unknown") || (rightDirection === "none" && leftDirection !== "none" && leftDirection !== "unknown");
  const opposingPolarity = leftPolarity !== 0 && rightPolarity !== 0 && leftPolarity !== rightPolarity;
  const categoricalOpposition = categoricalOpposites.find(([first, second]) =>
    (left.includes(first) && right.includes(second)) || (left.includes(second) && right.includes(first)),
  );

  if (opposingDirection || opposingPolarity || categoricalOpposition) {
    const methodologyDiffers = methodOverlap < 0.25;
    return {
      status: methodologyDiffers ? "TENSION" : "CONTRADICTED",
      confidence: methodologyDiffers ? 0.8 : Math.min(0.96, 0.78 + overlap.score * 0.18),
      explanation: methodologyDiffers
        ? `The claims oppose each other on ${overlap.shared.slice(0, 4).join(", ")}, but their methods or populations differ enough to treat this as a contextual tension.`
        : categoricalOpposition
          ? `The claims otherwise overlap but use mutually exclusive conditions: ${categoricalOpposition[0]} versus ${categoricalOpposition[1]}.`
          : `The claims discuss the same subject and outcome (${overlap.shared.slice(0, 4).join(", ")}) but make opposing directional or significance statements.`,
    };
  }

  if (leftNumbers.length > 0 && rightNumbers.length > 0) {
    const leftValue = Number(leftNumbers[0]!.replace("%", ""));
    const rightValue = Number(rightNumbers[0]!.replace("%", ""));
    const relativeDifference = Math.abs(leftValue - rightValue) / Math.max(Math.abs(leftValue), Math.abs(rightValue), 1);
    if (relativeDifference >= 0.35) {
      return {
        status: "TENSION",
        confidence: 0.82,
        explanation: "The claims agree in direction but report materially different effect sizes; compare population, baseline, method, and uncertainty intervals.",
      };
    }
  }

  const leftHedged = hasAny(left, hedges);
  const rightHedged = hasAny(right, hedges);
  if (leftPolarity === rightPolarity && leftPolarity !== 0 && leftHedged !== rightHedged) {
    return {
      status: "PARTIALLY_SUPPORTED",
      confidence: 0.75,
      explanation: "The claims point in the same direction, but one is conditional or associative while the other is stronger or causal.",
    };
  }

  if ((leftPolarity === rightPolarity && leftPolarity !== 0) || (leftDirection === rightDirection && leftDirection !== "unknown")) {
    return {
      status: "SUPPORTED",
      confidence: Math.min(0.9, 0.65 + overlap.score * 0.2),
      explanation: `The claims discuss overlapping subject matter (${overlap.shared.slice(0, 4).join(", ")}) and agree in direction.`,
    };
  }

  if (overlap.score >= 0.55) {
    return {
      status: "INCONCLUSIVE",
      confidence: 0.7,
      explanation: "The claims are topically close, but their wording does not establish the same outcome, direction, or causal strength.",
    };
  }

  return {
    status: "INCONCLUSIVE",
    confidence: 0.62,
    explanation: "The available wording does not establish support or contradiction.",
  };
}
