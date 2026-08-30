import type { AuthenticityTier, DocumentType, EvidenceType, SourceReference } from "@thread/shared";

export interface SourceMetadataInput {
  title: string;
  url: string;
  author?: string;
  authors?: string[];
  publicationDate?: string;
  documentType?: DocumentType;
  publisher?: string;
  journal?: string;
  doi?: string;
  citationCount?: number | null;
  referenceCount?: number | null;
  citedByUrl?: string;
  pdfUrl?: string;
  metadataProvider?: string;
  references?: SourceReference[];
}

export interface SourceIntelligence extends Required<Omit<SourceMetadataInput, "citationCount" | "referenceCount">> {
  citationCount: number | null;
  referenceCount: number | null;
  sourceType: EvidenceType;
  citationText: string;
  peerReviewStatus: "likely" | "unknown" | "not_applicable";
  authenticityScore: number;
  authenticityTier: AuthenticityTier;
  authenticitySignals: string[];
}

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  publisher?: string;
  "container-title"?: string[];
  type?: string;
  URL?: string;
  "is-referenced-by-count"?: number;
  "reference-count"?: number;
  published?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
};

const compact = (value = "") => value.replace(/\s+/g, " ").trim();

export function normalizeDoi(value = "") {
  const decoded = decodeURIComponent(value).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return compact(decoded.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/i)?.[0] ?? "").replace(/[.,;]+$/, "").toLowerCase();
}

export function normalizePublicationDate(value = "") {
  const compacted = compact(value).replaceAll("/", "-");
  const match = compacted.match(/\b(19|20)\d{2}(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!match) return "";
  const year = match[0].slice(0, 4);
  const month = match[2]?.padStart(2, "0") ?? "01";
  const day = match[3]?.padStart(2, "0") ?? "01";
  return `${year}-${month}-${day}`;
}

export function calculateFreshnessScore(publicationDate: string) {
  const normalized = normalizePublicationDate(publicationDate);
  if (!normalized) return 45;
  const ageYears = Math.max(0, (Date.now() - new Date(normalized).getTime()) / 31_557_600_000);
  return Math.max(20, Math.min(100, Math.round(100 - ageYears * 6)));
}

export function classifyDocument(input: SourceMetadataInput): DocumentType {
  if (input.documentType && input.documentType !== "unknown") return input.documentType;
  const url = input.url.toLowerCase();
  const host = (() => { try { return new URL(input.url).hostname.toLowerCase(); } catch { return ""; } })();
  const provider = input.metadataProvider?.toLowerCase() ?? "";
  if (input.journal) return "journal_article";
  if (/conference|proceedings/.test(`${input.publisher} ${provider}`.toLowerCase())) return "conference_paper";
  if (/arxiv\.org|biorxiv\.org|medrxiv\.org|ssrn\.com/.test(host)) return "preprint";
  if (/thesis|dissertation/.test(`${input.title} ${url}`.toLowerCase())) return "thesis";
  if (/\.gov$|\.gov\.|who\.int$|oecd\.org$|worldbank\.org$/.test(host)) return "government_report";
  if (/kaggle\.com|data\.gov|zenodo\.org|figshare\.com/.test(host)) return "dataset";
  if (/docs\.|documentation|developer\.|\/docs\//.test(`${host}${url}`)) return "documentation";
  if (/\.pdf(?:$|[?#])/.test(url) || input.pdfUrl) return "pdf";
  if (/news|reuters\.com|apnews\.com|bbc\.|nytimes\.com/.test(host)) return "news_article";
  if (/blog|medium\.com|substack\.com/.test(`${host}${url}`)) return "blog_post";
  if (input.doi || provider.includes("scholar") || provider.includes("crossref")) return "journal_article";
  return "webpage";
}

export function evidenceTypeForDocument(type: DocumentType): EvidenceType {
  if (["journal_article", "conference_paper", "preprint", "thesis", "book_chapter"].includes(type)) return "research paper";
  if (["technical_report", "government_report"].includes(type)) return "report";
  if (type === "dataset") return "dataset";
  if (type === "documentation") return "documentation";
  if (type === "news_article") return "news";
  if (type === "blog_post") return "blog";
  return type === "webpage" || type === "pdf" ? "article" : "unknown";
}

function formatAuthors(authors: string[]) {
  if (!authors.length) return "Unknown author";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

export function formatCitation(input: Pick<SourceMetadataInput, "title" | "url" | "authors" | "author" | "publicationDate" | "journal" | "publisher" | "doi">) {
  const authors = input.authors?.filter(Boolean) ?? (input.author && input.author !== "Unknown author" ? [input.author] : []);
  const year = normalizePublicationDate(input.publicationDate).slice(0, 4) || "n.d.";
  const venue = compact(input.journal || input.publisher || "");
  const locator = normalizeDoi(input.doi) ? `https://doi.org/${normalizeDoi(input.doi)}` : input.url;
  return compact(`${formatAuthors(authors)} (${year}). ${input.title}.${venue ? ` ${venue}.` : ""} ${locator}`);
}

function crossrefDate(work: CrossrefWork) {
  const parts = work.published?.["date-parts"]?.[0] ?? work.issued?.["date-parts"]?.[0] ?? [];
  if (!parts[0]) return "";
  return `${parts[0]}-${String(parts[1] ?? 1).padStart(2, "0")}-${String(parts[2] ?? 1).padStart(2, "0")}`;
}

async function lookupCrossref(doi: string): Promise<CrossrefWork | null> {
  if (!doi) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": `THREAD-Research-Intelligence/0.1 (${process.env.CROSSREF_MAILTO ?? "local-research-app"})` },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { message?: CrossrefWork };
    return payload.message ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function tierFor(score: number, verified: boolean): AuthenticityTier {
  if (verified) return "verified";
  if (score >= 75) return "strong";
  if (score >= 50) return "moderate";
  if (score >= 25) return "weak";
  return "unverified";
}

export async function analyzeSourceMetadata(input: SourceMetadataInput): Promise<SourceIntelligence> {
  const suppliedDoi = normalizeDoi(input.doi || input.url);
  const crossref = await lookupCrossref(suppliedDoi);
  const authors = crossref?.author?.map((author) => compact(`${author.given ?? ""} ${author.family ?? ""}`)).filter(Boolean)
    ?? input.authors?.filter(Boolean)
    ?? (input.author && input.author !== "Unknown author" ? [input.author] : []);
  const title = compact(crossref?.title?.[0] || input.title);
  const publicationDate = crossrefDate(crossref ?? {}) || normalizePublicationDate(input.publicationDate);
  const doi = normalizeDoi(crossref?.DOI || suppliedDoi);
  const journal = compact(crossref?.["container-title"]?.[0] || input.journal);
  const publisher = compact(crossref?.publisher || input.publisher);
  const metadataProvider = crossref ? "crossref" : compact(input.metadataProvider || "page");
  const documentType = classifyDocument({ ...input, title, publicationDate, doi, journal, publisher, metadataProvider });
  const host = (() => { try { return new URL(input.url).hostname.toLowerCase(); } catch { return ""; } })();
  const signals: string[] = [];
  let score = 0;
  if (input.url.startsWith("https://")) { score += 8; signals.push("Secure HTTPS source URL"); }
  if (crossref && doi) { score += 30; signals.push("DOI metadata verified with Crossref"); }
  else if (doi) { score += 12; signals.push("DOI detected but not independently verified"); }
  if (authors.length) { score += 12; signals.push("Named author metadata present"); }
  if (publicationDate) { score += 10; signals.push("Publication date present"); }
  if (journal || publisher) { score += 12; signals.push("Journal or publisher metadata present"); }
  if (/\.gov$|\.gov\.|\.edu$|\.edu\.|\.ac\.|who\.int$/.test(host)) { score += 14; signals.push("Institutional, academic, or government domain"); }
  if ((input.citationCount ?? crossref?.["is-referenced-by-count"] ?? 0) > 0) { score += 6; signals.push("Independent citation activity recorded"); }
  if (["blog_post", "opinion"].includes(documentType)) { score -= 10; signals.push("Informal publication format; verify claims independently"); }
  if (!authors.length) signals.push("Author identity is missing");
  if (!publicationDate) signals.push("Publication date is missing");
  score = Math.max(0, Math.min(100, score));
  const peerReviewStatus = documentType === "journal_article" && Boolean(journal) ? "likely" : ["webpage", "news_article", "blog_post", "documentation", "dataset"].includes(documentType) ? "not_applicable" : "unknown";
  const result = {
    title,
    url: input.url,
    author: authors.join(", ") || input.author || "Unknown author",
    authors,
    publicationDate,
    documentType,
    publisher,
    journal,
    doi,
    citationCount: input.citationCount ?? crossref?.["is-referenced-by-count"] ?? null,
    referenceCount: input.referenceCount ?? crossref?.["reference-count"] ?? null,
    citedByUrl: input.citedByUrl || "",
    pdfUrl: input.pdfUrl || "",
    metadataProvider,
    references: input.references ?? [],
    sourceType: evidenceTypeForDocument(documentType),
    peerReviewStatus,
    authenticityScore: score,
    authenticityTier: tierFor(score, Boolean(crossref && doi)),
    authenticitySignals: signals,
  } satisfies Omit<SourceIntelligence, "citationText">;
  return { ...result, citationText: formatCitation(result) };
}
