import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ResearchDataset } from "@thread/shared";
import { calculateResearchHealth } from "@/lib/analysis/research-health";

const ink = "#171717";
const muted = "#626262";
const line = "#D8D4CA";
const accent = "#2457D6";
const warning = "#9A6500";

function safe(value: string) {
  return value.replace(/[\u2010-\u2015]/g, "-").replace(/\u2026/g, "...");
}

// Renders a real plural ("1 evidence unit" / "2 evidence units") instead of the "unit(s)"
// shorthand, which reads as an unfinished template in an exported research document.
function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export async function generateResearchReport(dataset: ResearchDataset): Promise<Buffer> {
  const health = calculateResearchHealth(dataset);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 64, right: 54, bottom: 64, left: 54 },
    bufferPages: true,
    info: {
      Title: `${dataset.project.title} - Structured research report`,
      Author: "THREAD Research Intelligence",
      Subject: dataset.project.researchQuestion,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const rule = () => {
    doc.x = doc.page.margins.left;
    doc.moveDown(0.5).strokeColor(line).lineWidth(0.7).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke().moveDown(0.7);
  };
  const section = (title: string) => {
    if (doc.y > 690) doc.addPage();
    doc.x = doc.page.margins.left;
    doc.moveDown(0.7).font("Helvetica-Bold").fontSize(14).fillColor(ink).text(safe(title));
    rule();
  };
  const paragraph = (text: string, color = ink) => {
    doc.x = doc.page.margins.left;
    doc.font("Helvetica").fontSize(9.5).fillColor(color).text(safe(text), { lineGap: 3 }).moveDown(0.55);
  };
  const bullet = (text: string) => {
    doc.x = doc.page.margins.left;
    doc.font("Helvetica").fontSize(9.3).fillColor(ink).text(`- ${safe(text)}`, { indent: 10, lineGap: 2 }).moveDown(0.3);
  };
  const labeled = (label: string, text: string, color = ink) => {
    doc.x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(ink).text(`${safe(label)}: `, { continued: true });
    doc.font("Helvetica").fillColor(color).text(safe(text), { lineGap: 3 }).moveDown(0.55);
  };

  doc.font("Helvetica-Bold").fontSize(9).fillColor(accent).text("THREAD / STRUCTURED RESEARCH REPORT", { characterSpacing: 1.2 });
  doc.moveDown(1).font("Helvetica-Bold").fontSize(25).fillColor(ink).text(safe(dataset.project.title), { lineGap: 2 });
  doc.moveDown(0.7).font("Helvetica").fontSize(13).fillColor(muted).text(safe(dataset.project.researchQuestion), { lineGap: 4 });
  doc.moveDown(1.4);
  const metrics = [
    ["Readiness", `${health.overall}/100`],
    ["Completion", `${health.completion}%`],
    ["Sources", dataset.sources.length],
    ["Evidence", dataset.evidence.length],
    ["Aspects", `${health.coveredAspects}/${health.totalAspects}`],
  ];
  const metricWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / metrics.length;
  const metricsY = doc.y;
  metrics.forEach(([label, value], index) => {
    const x = doc.page.margins.left + index * metricWidth;
    doc.font("Helvetica-Bold").fontSize(15).fillColor(ink).text(String(value), x, metricsY, { width: metricWidth - 8 });
    doc.font("Helvetica").fontSize(8).fillColor(muted).text(String(label).toUpperCase(), x, metricsY + 21, { width: metricWidth - 8 });
  });
  doc.x = doc.page.margins.left;
  doc.y = metricsY + 48;
  rule();
  paragraph(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}. This report is grounded only in evidence stored in THREAD.`, muted);

  const sourceNumbers = new Map(dataset.sources.map((source, index) => [source.id, index + 1]));
  const evidenceCitation = (evidenceIds: string[]) => [...new Set(evidenceIds.map((id) => dataset.evidence.find((item) => item.id === id)?.sourceId).filter(Boolean).map((id) => sourceNumbers.get(id!)).filter(Boolean))].map((number) => `[${number}]`).join(" ");

  const leadingInsight = dataset.insights[0];

  section("Research readiness audit");
  labeled("Is it perfect", health.verdicts.perfect);
  labeled("Is it completed", health.verdicts.completed);
  labeled("Did it cover every core aspect", health.verdicts.coverage);
  labeled("Readiness stage", health.stage.replaceAll("_", " "));
  const failedGates = health.completionGates.filter((gate) => !gate.passed);
  if (failedGates.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text("Blocking readiness gates").moveDown(0.4);
    failedGates.forEach((gate) => bullet(`${gate.label}: ${gate.current}. Required: ${gate.requirement}.`));
  }

  section("Abstract");
  labeled("Background", dataset.project.description || "The project scope has not been described sufficiently to establish a complete background.");
  labeled("Aim", `Assess the question: ${dataset.project.researchQuestion}`);
  labeled("Methods", `THREAD synthesized ${dataset.evidence.length} captured evidence units from ${dataset.sources.length} sources, preserving provenance, source classification, methods, limitations, and claim relationships.`);
  labeled("Results", leadingInsight?.description || (dataset.evidence.length ? "The evidence base has begun to form, but the stored material is not broad enough for a defensible conclusion." : "No evidence has been captured, so no research finding is reported."));
  labeled("Conclusion", health.isComplete ? "All automated readiness gates are satisfied; the synthesis is ready for expert review but is not declared perfect or final." : `The research is not complete. Current readiness is ${health.overall}/100, with ${failedGates.length} blocking gates and ${health.missingAspects.length} missing or thin aspects.`);

  section("1. Introduction");
  paragraph(`Research question: ${dataset.project.researchQuestion}`);
  paragraph(dataset.project.description || "No project description was provided.");
  paragraph("This report treats captured passages as evidence units, preserves their provenance, and separates what the sources state from THREAD's synthesis.", muted);
  paragraph(`Scope warning: ${health.verdicts.coverage}`, warning);

  section("2. Methods");
  bullet("Protocol: define the question, scope, keywords, databases, and inclusion or exclusion rules before interpreting findings.");
  bullet("Source screening: classify document type, verify bibliographic metadata when available, and record authenticity signals without treating popularity as proof.");
  bullet("Evidence extraction: retain exact selected text, surrounding context, URL, author, publication date, method notes, limitations, and persistent identifiers.");
  bullet("Synthesis: normalize each passage into a claim, then compare subject, population, outcome, direction, magnitude, and methodology.");
  bullet("Contradictions: direct opposition is separated from contextual tension, partial support, unrelated claims, and insufficient evidence.");
  bullet("Reporting: every claim below carries numbered source references; uncaptured references are not promoted to evidence.");

  section("3. Evidence base and source characteristics");
  labeled("Evidence depth", `${health.evidenceDepth}/100 across ${dataset.evidence.length} evidence units and ${dataset.sources.length} sources.`);
  labeled("Source credibility", `${health.sourceQuality}/100 based on authenticity, bibliographic provenance, and source quality signals.`);
  labeled("Source diversity", `${health.sourceDiversity}/100 across ${new Set(dataset.sources.map((source) => source.domain)).size} domains and ${new Set(dataset.sources.map((source) => source.documentType)).size} document types.`);
  labeled("Methodological rigor", `${health.methodologicalRigor}/100 based on captured methods, designs, and limitations.`);
  labeled("Citation completeness", `${health.citationCompleteness}/100. Missing metadata remains visible rather than being invented.`);
  if (!dataset.sources.length) paragraph("No sources have been captured.", muted);
  dataset.sources.slice(0, 20).forEach((source, index) => bullet(`[${index + 1}] ${source.documentType.replaceAll("_", " ")} - ${source.title}; authenticity ${source.authenticityScore}/100; ${pluralize(source.evidenceIds.length, "captured evidence unit", "captured evidence units")}.`));

  section("4. Results");
  if (!dataset.claims.length) paragraph("No claims have been extracted yet.", muted);
  dataset.claims.slice(0, 20).forEach((claim, index) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(`${index + 1}. ${safe(claim.text)} ${evidenceCitation(claim.evidenceIds)}`);
    doc.font("Helvetica").fontSize(8.5).fillColor(muted).text(`${claim.topic} | ${Math.round(claim.confidence * 100)}% confidence | ${pluralize(claim.evidenceIds.length, "evidence item")}`).moveDown(0.55);
  });

  section("5. Contradictions and alternative explanations");
  labeled("Contradiction testing", `${health.contradictionTesting}/100 across ${dataset.claimRelations.length} explicit claim comparisons.`);
  if (!dataset.conflicts.length) paragraph(health.contradictionTesting >= 60 ? "No contradiction was found after the current comparison coverage." : "No stored contradiction has been detected, but contradiction testing is incomplete; absence of a detected conflict is not evidence of consensus.", muted);
  dataset.conflicts.slice(0, 15).forEach((conflict) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(warning).text(`${safe(conflict.title)} ${evidenceCitation([...conflict.supportingEvidence, ...conflict.contradictingEvidence])}`);
    paragraph(`${conflict.severity.toUpperCase()} | ${conflict.resolution} | ${Math.round(conflict.confidence * 100)}% confidence`, muted);
    if (conflict.resolutionChoice) labeled("Final decision", conflict.resolutionChoice.replaceAll("_", " "));
    if (conflict.resolutionRationale) labeled("Decision rationale", conflict.resolutionRationale);
    conflict.explanation.filter((note) => !/^Resolution (decision|rationale): |^Resolved at: /.test(note)).forEach(bullet);
  });

  section("6. Discussion");
  if (!dataset.insights.length) paragraph("No research insights have been generated yet.", muted);
  dataset.insights.slice(0, 12).forEach((insight) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(`${safe(insight.title)} ${evidenceCitation([...insight.supportingEvidence, ...insight.contradictingEvidence])}`);
    paragraph(insight.description);
    paragraph(`Recommended action: ${insight.recommendedAction}`, accent);
  });
  if (dataset.gaps.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text("Priority knowledge gaps").moveDown(0.4);
    dataset.gaps.slice().sort((a, b) => a.coverage - b.coverage).slice(0, 8).forEach((gap) => bullet(`${gap.topic}: ${gap.coverage}% coverage - ${gap.whyItMatters}`));
  }
  if (dataset.tasks.length) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text("Recommended next actions").moveDown(0.4);
    dataset.tasks.slice(0, 8).forEach((task) => bullet(`${task.expectedValue} value - ${task.title}: ${task.reason}`));
  }

  section("7. Limitations");
  bullet("The synthesis is limited to evidence explicitly captured in this project; uncaptured literature cannot influence the result.");
  bullet("Source authenticity scores summarize provenance signals and do not certify truth, peer-review quality, causal validity, or freedom from bias.");
  bullet("Automated aspect and contradiction checks cannot replace subject-matter, statistical, ethical, or methodological peer review.");
  health.missingAspects.forEach((aspect) => bullet(`${aspect} is currently missing or supported too thinly.`));
  [...new Set(dataset.evidence.flatMap((evidence) => evidence.limitations).filter(Boolean))].slice(0, 15).forEach((limitation) => bullet(limitation));

  section("8. Conclusion");
  // This section previously reused `leadingInsight.description` — the same sentence already
  // shown under "Abstract > Results" — so the report's conclusion never actually addressed the
  // research question, just repeated whichever single insight happened to be first. It now
  // synthesizes across the full claim and conflict set instead of echoing one insight.
  paragraph(`Research question: ${dataset.project.researchQuestion}`);
  if (!dataset.claims.length) {
    paragraph("No claims have been extracted yet, so this project cannot yet support a conclusion on the research question.", muted);
  } else {
    const sourceByEvidenceId = new Map(dataset.evidence.map((item) => [item.id, item.sourceId]));
    const corroboratedClaims = dataset.claims.filter(
      (claim) => new Set(claim.evidenceIds.map((id) => sourceByEvidenceId.get(id) ?? id)).size >= 2,
    ).length;
    const unresolvedConflicts = dataset.conflicts.filter((conflict) => conflict.resolution === "unresolved");
    const resolvedConflictCount = dataset.conflicts.length - unresolvedConflicts.length;
    paragraph(
      `${pluralize(dataset.claims.length, "claim")} extracted from ${pluralize(dataset.sources.length, "source")}; ` +
        `${corroboratedClaims} of ${dataset.claims.length} are corroborated by two or more independent sources. ` +
        (dataset.conflicts.length
          ? `${unresolvedConflicts.length} of ${pluralize(dataset.conflicts.length, "recorded contradiction")} remain unresolved${resolvedConflictCount ? ` (${resolvedConflictCount} resolved)` : ""}, so a single directional answer to the research question is not yet supported.`
          : "No contradictions have been recorded against these claims yet, though contradiction testing coverage should be checked against Section 5 before treating that as agreement."),
    );
  }
  paragraph(health.isComplete ? "Every current readiness gate is satisfied. The work can proceed to expert review, replication checks, and publication-specific editing." : `This project is not complete. Resolve the ${failedGates.length} failed readiness gates before treating the synthesis as a finished research paper.`, warning);

  section("9. References");
  if (!dataset.sources.length) paragraph("No sources have been captured yet.", muted);
  dataset.sources.forEach((source, index) => {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(ink).text(`[${index + 1}] ${safe(source.citationText || `${source.author} (${source.publicationDate || "n.d."}). ${source.title}. ${source.url}`)}`);
    doc.font("Helvetica").fontSize(8).fillColor(muted).text(`${source.documentType.replaceAll("_", " ")} | authenticity ${source.authenticityScore}/100 (${source.authenticityTier})${source.doi ? ` | DOI ${source.doi}` : ""}`).moveDown(0.6);
  });

  section("Appendix A. Evidence register");
  if (!dataset.evidence.length) paragraph("No evidence has been captured yet.", muted);
  dataset.evidence.slice(0, 50).forEach((evidence, index) => {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(ink).text(`${index + 1}. ${safe(evidence.extractedClaim)} ${evidenceCitation([evidence.id])}`);
    doc.font("Helvetica").fontSize(8).fillColor(muted).text(`${safe(evidence.pageTitle)} | ${safe(evidence.author)} | ${evidence.evidenceType} | ${Math.round(evidence.confidence * 100)}% confidence`);
    doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(ink).text(`"${safe(evidence.selectedText)}"`, { lineGap: 2 });
    doc.font("Helvetica").fontSize(7.8).fillColor(accent).text(evidence.url, { link: evidence.url, underline: true }).moveDown(0.75);
  });

  section("Appendix B. Topic aspect audit");
  health.aspectAudit.forEach((aspect) => bullet(`${aspect.label}: ${aspect.score}/100 (${aspect.status}); ${aspect.evidenceCount} evidence units from ${aspect.sourceCount} sources. ${aspect.whyItMatters}`));

  section("Appendix C. Reproducibility notes");
  bullet("The report reflects only evidence explicitly captured in this project.");
  bullet("Confidence and completion scores are decision aids, not statistical probabilities or publication guarantees.");
  bullet("Every stored claim should be traceable to numbered references and exact captured passages in Appendix A.");
  bullet("Google Scholar citation counts and Crossref metadata can change over time; verify critical references against the original publication before submission.");

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7.5).fillColor(muted).text(
      `THREAD | ${safe(dataset.project.title)}`,
      doc.page.margins.left,
      doc.page.height - 34,
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "left", lineBreak: false },
    );
    doc.text(`Page ${index + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 34, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return finished;
}
