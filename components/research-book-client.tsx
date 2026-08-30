"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { BookOpen, Download, Search, Trash2 } from "lucide-react";
import type { Evidence, ResearchDataset } from "@thread/shared";
import { DetailPanel } from "@/components/detail-panel";
import { PageIntro, SummaryBand } from "@/components/page-shell";

const tabs = ["overview", "sources", "evidence", "claims", "relations", "insights", "conflicts", "gaps", "tasks", "timeline", "graph"] as const;
type TabName = (typeof tabs)[number];
type DeletionKind = "source" | "evidence" | "claim" | "relation" | "insight" | "conflict" | "gap" | "task" | "timeline";
type DeletionTarget = { kind: DeletionKind; id: string; label: string; consequence: string };

export function ResearchBookClient({ dataset, initialQuery = "", focusSearch = false }: { dataset: ResearchDataset; initialQuery?: string; focusSearch?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabName>("overview");
  const [query, setQuery] = useState(initialQuery);
  const [sourceType, setSourceType] = useState("all");
  const [topic, setTopic] = useState("all");
  const [stance, setStance] = useState("all");
  const [minConfidence, setMinConfidence] = useState("0");
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  const normalized = query.toLowerCase();
  const filteredEvidence = useMemo(
    () => dataset.evidence.filter((item) =>
      `${item.selectedText} ${item.extractedClaim} ${item.pageTitle} ${item.topic}`.toLowerCase().includes(normalized) &&
      (sourceType === "all" || item.evidenceType === sourceType) &&
      (topic === "all" || item.topic === topic) &&
      (stance === "all" || item.stance === stance) &&
      item.confidence >= Number(minConfidence),
    ),
    [dataset.evidence, minConfidence, normalized, sourceType, stance, topic],
  );
  const filteredSources = dataset.sources.filter((source) => `${source.title} ${source.author} ${source.summary}`.toLowerCase().includes(normalized) && (sourceType === "all" || source.sourceType === sourceType));
  const filteredClaims = dataset.claims.filter((claim) => `${claim.text} ${claim.topic}`.toLowerCase().includes(normalized) && (topic === "all" || claim.topic === topic) && claim.confidence >= Number(minConfidence));
  const topicOptions = [...new Set(dataset.evidence.map((item) => item.topic))].sort();
  const sourceTypeOptions = [...new Set(dataset.sources.map((item) => item.sourceType))].sort();
  const researchStep = dataset.sources.length === 0 ? 1 : dataset.evidence.length === 0 ? 2 : dataset.claims.length === 0 ? 3 : dataset.claimRelations.length === 0 && dataset.conflicts.length === 0 ? 4 : dataset.insights.length === 0 && dataset.gaps.length === 0 ? 5 : 6;
  const claimsById = new Map(dataset.claims.map((claim) => [claim.id, claim]));
  const removeRecord = async () => {
    if (!deletionTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/projects/${dataset.project.id}/items/${deletionTarget.kind}/${encodeURIComponent(deletionTarget.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The research record could not be deleted.");
      if (deletionTarget.kind === "evidence") setSelectedEvidence(null);
      setDeletionTarget(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "The research record could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };
  const askToDelete = (kind: DeletionKind, id: string, label: string, consequence = "The record is permanently removed from this research project.") => {
    setDeleteError("");
    setDeletionTarget({ kind, id, label, consequence });
  };

  return (
    <VStack gap={6}>
      <PageIntro
        crumbs={[{ label: "Output" }, { label: "Research library" }]}
        eyebrow="RESEARCH BOOK"
        icon={<BookOpen />}
        title="The record behind the conclusions."
        question="Inspect every source, excerpt, claim, relationship, conflict, gap, task, and change in understanding."
        actions={<Button label="Download structured report" href={`/api/reports/${dataset.project.id}`} icon={<Download />} variant="primary" size="sm" />}
      />
      <SummaryBand
        label="Library summary"
        stats={[
          { label: "Sources", value: dataset.sources.length },
          { label: "Evidence", value: dataset.evidence.length, emphasis: true },
          { label: "Claims", value: dataset.claims.length },
          { label: "Contradictions", value: dataset.conflicts.length },
          { label: "Open gaps", value: dataset.gaps.length },
        ]}
      />
      <header className="page-header library-filters">
        <VStack gap={4}>
          <HStack justify="between" align="end" gap={6} wrap="wrap">
            <VStack gap={2} align="end"><TextInput ref={searchRef} label="Global research search" value={query} onChange={setQuery} placeholder="Search everything…" startIcon={<Search />} hasClear width={280} /></VStack>
          </HStack>
          <HStack gap={3} wrap="wrap" align="end">
            <label className="field-label">Source type<select className="native-select" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="all">All types</option>{sourceTypeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field-label">Topic<select className="native-select" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">All topics</option>{topicOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field-label">Stance<select className="native-select" value={stance} onChange={(event) => setStance(event.target.value)}><option value="all">All stances</option>{["supports", "contradicts", "neutral", "unclear"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field-label">Confidence<select className="native-select" value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)}><option value="0">Any confidence</option><option value="0.7">70%+</option><option value="0.8">80%+</option><option value="0.9">90%+</option></select></label>
          </HStack>
        </VStack>
      </header>
      <nav className="research-tabs" aria-label="Research book sections">
        <TabList value={tab} onChange={(value) => setTab(value as TabName)} role="tablist" hasDivider overflow="scroll">
          {tabs.map((value) => <Tab key={value} value={value} label={value.toUpperCase()} panelId={`research-${value}`} endContent={value === "sources" ? <Badge label={filteredSources.length} /> : value === "evidence" ? <Badge label={filteredEvidence.length} /> : undefined} />)}
        </TabList>
      </nav>

      <section id={`research-${tab}`} role="tabpanel">
        {tab === "overview" ? (
          <VStack gap={5}>
            <Grid columns={{ minWidth: 280, max: 3, repeat: "fit" }} gap={4}>
              <Card padding={5}><VStack gap={3}><Text type="supporting" color="secondary">COLLECTION</Text><Heading level={2}>{dataset.sources.length} sources</Heading><Text color="secondary">{dataset.evidence.length} captured excerpts with provenance and method notes.</Text><Button label="Browse sources" onClick={() => setTab("sources")} /></VStack></Card>
              <Card padding={5}><VStack gap={3}><Text type="supporting" color="secondary">UNDERSTANDING</Text><Heading level={2}>{dataset.claims.length} claims</Heading><Text color="secondary">{dataset.claimRelations.length} explicit claim relationships.</Text><Button label="Browse claims" onClick={() => setTab("claims")} /></VStack></Card>
              <Card padding={5}><VStack gap={3}><Text type="supporting" color="secondary">UNCERTAINTY</Text><Heading level={2}>{dataset.conflicts.length} conflicts · {dataset.gaps.length} gaps</Heading><Text color="secondary">Unresolved findings are converted into ranked research work.</Text><Button label="See gaps" onClick={() => setTab("gaps")} /></VStack></Card>
            </Grid>
            <Card padding={5}>
              <VStack gap={4}>
                <VStack gap={1}><Text type="supporting" color="secondary">RESEARCH METHOD</Text><Heading level={2}>From question to defensible paper</Heading><Text color="secondary">THREAD follows an evidence-review workflow, then exports findings in standard research-paper order.</Text></VStack>
                <Stepper activeStep={researchStep} orientation="vertical" density="compact" label="Research workflow">
                  <Step step={0} label="Question and scope" description="Define the research question, population or context, outcomes, and boundaries." />
                  <Step step={1} label="Search protocol" description="Record keywords, databases, date ranges, and inclusion or exclusion rules before collecting evidence." />
                  <Step step={2} label="Screen and appraise sources" description="Classify each document, verify metadata, score authenticity signals, and retain rejection reasons." />
                  <Step step={3} label="Extract evidence and claims" description="Capture exact passages with context, method, limitations, identifiers, and canonical citations." />
                  <Step step={4} label="Synthesize and test contradictions" description="Compare claims only after matching subject, outcome, population, method, and direction." />
                  <Step step={5} label="Resolve gaps and qualify conclusions" description="Investigate missing evidence, alternative explanations, bias, and unresolved tensions." />
                  <Step step={6} label="Write and cite" description="Export title, abstract, introduction, methods, results, discussion, conclusion, and references." />
                </Stepper>
              </VStack>
            </Card>
          </VStack>
        ) : null}

        {deleteError ? <section className="status-banner is-warning"><Text>{deleteError}</Text></section> : null}

        {tab === "sources" ? (
          <section className="record-list">
            {filteredSources.length ? filteredSources.map((source, index) => (
              <article key={source.id} className="source-row">
                <Grid columns={3} gap={4} align="center">
                  <VStack gap={1}><Text weight="semibold">{source.title}</Text><Text type="supporting" color="secondary">{source.journal || source.publisher || source.domain} · {source.author}</Text><Citation variant="label" number={index + 1} source={{ title: source.citationText || source.title, url: source.url }} /></VStack>
                  <VStack gap={2}><HStack gap={2} wrap="wrap"><Badge label={source.documentType.replaceAll("_", " ")} /><Badge label={`${source.citationCount ?? 0} citations`} /></HStack><StatusDot variant={source.authenticityScore >= 75 ? "success" : source.authenticityScore >= 50 ? "warning" : "error"} label={`${source.authenticityTier} · ${source.authenticityScore}/100`} /></VStack>
                  <HStack justify="end" gap={2}><Text type="supporting" color="secondary">{source.evidenceIds.length} evidence</Text><Button label="Inspect" href={`/research/source/${source.id}`} variant="ghost" size="sm" icon={<Search />} /><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("source", source.id, source.title, "The source and every captured excerpt derived from it are permanently removed. Dependent claims and analysis are cleaned up automatically.")} /></HStack>
                </Grid>
              </article>
            )) : <Card padding={6}><Text>No sources match these filters.</Text></Card>}
          </section>
        ) : null}

        {tab === "evidence" ? (
          <section className="record-list">
            {filteredEvidence.length ? filteredEvidence.map((item) => (
              <article key={item.id} className="evidence-row">
                <Grid columns={3} gap={4} align="center">
                  <VStack gap={1}><Text weight="semibold" maxLines={2}>“{item.selectedText}”</Text><Text type="supporting" color="secondary">{item.pageTitle} · {item.id}</Text></VStack>
                  <HStack gap={2} wrap="wrap"><Badge label={item.topic} /><Badge label={item.stance} variant={item.stance === "contradicts" ? "red" : item.stance === "supports" ? "green" : "neutral"} /></HStack>
                  <HStack justify="end" gap={2}><Text type="supporting" color="secondary">{Math.round(item.confidence * 100)}%</Text><Button label="Inspect" variant="ghost" size="sm" icon={<Search />} onClick={() => setSelectedEvidence(item)} /><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("evidence", item.id, item.extractedClaim, "This excerpt is permanently removed. Claims, conflicts, insights, timeline entries, and graph links that depend only on it are also removed.")} /></HStack>
                </Grid>
              </article>
            )) : <Card padding={6}><Text>No evidence matches these filters. Clear one or more filters to widen the view.</Text></Card>}
          </section>
        ) : null}

        {tab === "claims" ? <section className="record-list">{filteredClaims.map((claim) => <article className="evidence-row" key={claim.id}><Grid columns={3} gap={4} align="center"><VStack gap={1}><Text weight="semibold">{claim.text}</Text><Text type="supporting" color="secondary">{claim.id}</Text></VStack><Badge label={claim.topic} /><HStack justify="end" gap={2}><Badge label={`${claim.evidenceIds.length} evidence`} /><Text type="supporting" color="secondary">{Math.round(claim.confidence * 100)}%</Text><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("claim", claim.id, claim.text, "The claim and its graph relationships are permanently removed. The original evidence remains available.")} /></HStack></Grid></article>)}</section> : null}

        {tab === "relations" ? <section className="record-list">{dataset.claimRelations.map((relation) => <article className="evidence-row" key={relation.id}><Grid columns={3} gap={4} align="center"><VStack gap={1}><Text weight="semibold">{claimsById.get(relation.fromClaimId)?.text ?? relation.fromClaimId}</Text><Text type="supporting" color="secondary">From claim</Text></VStack><VStack gap={1}><Badge label={relation.type.replaceAll("_", " ")} /><Text type="supporting" color="secondary">{Math.round(relation.confidence * 100)}% confidence</Text></VStack><HStack justify="end" gap={2}><Text maxLines={2}>{claimsById.get(relation.toClaimId)?.text ?? relation.toClaimId}</Text><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("relation", relation.id, `${relation.type.replaceAll("_", " ")} relationship`)} /></HStack></Grid></article>)}</section> : null}

        {tab === "insights" ? <section className="record-list">{dataset.insights.map((item) => <article className="evidence-row" key={item.id}><Grid columns={3} gap={4} align="center"><VStack gap={1}><Text weight="semibold">{item.title}</Text><Text color="secondary" maxLines={2}>{item.description}</Text></VStack><Badge label={item.type.replaceAll("_", " ")} /><HStack justify="end" gap={2}><Text type="supporting" color="secondary">{Math.round(item.confidence * 100)}%</Text><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("insight", item.id, item.title)} /></HStack></Grid></article>)}</section> : null}

        {tab === "conflicts" ? <VStack gap={4}><section className="record-list">{dataset.conflicts.map((item) => <article className="conflict-row" key={item.id}><HStack justify="between" gap={4}><VStack gap={1}><Text weight="semibold">{item.title}</Text><Text color="secondary">{item.topic}</Text></VStack><HStack gap={2}><Badge label={item.status.replaceAll("_", " ")} variant="red" />{item.id.startsWith("derived:") ? <Badge label="COMPUTED" /> : <Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("conflict", item.id, item.title)} />}</HStack></HStack></article>)}</section><Button label="Open contradiction radar" href="/conflicts" variant="primary" /></VStack> : null}

        {tab === "gaps" ? <VStack gap={4}><section className="record-list">{dataset.gaps.map((item) => <article className="evidence-row" key={item.id}><HStack justify="between" gap={4}><VStack gap={1}><Text weight="semibold">{item.topic}</Text><Text color="secondary">{item.whyItMatters}</Text></VStack><HStack gap={2}><Badge label={`${item.coverage}% coverage`} variant="yellow" /><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("gap", item.id, `${item.topic} knowledge gap`)} /></HStack></HStack></article>)}</section><Button label="Open knowledge gap map" href="/gaps" variant="primary" /></VStack> : null}

        {tab === "tasks" ? <VStack gap={4}><section className="record-list">{dataset.tasks.map((item) => <article className="task-row" key={item.id}><HStack justify="between" gap={4}><VStack gap={1}><Text weight="semibold">{item.title}</Text><Text color="secondary">{item.reason}</Text></VStack><HStack gap={2}><Badge label={`${item.expectedValue} value`} variant="blue" /><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("task", item.id, item.title)} /></HStack></HStack></article>)}</section><Button label="Open ranked research" href="/next" variant="primary" /></VStack> : null}

        {tab === "timeline" ? <VStack gap={4}><section className="record-list">{dataset.timeline.slice().reverse().map((item) => <article className="timeline-row" key={item.id}><HStack justify="between" gap={4}><VStack gap={1}><Text weight="semibold">{item.title}</Text><Text color="secondary">{item.description}</Text><Text type="supporting" color="secondary">{new Date(item.occurredAt).toLocaleString()}</Text></VStack><Button label="Delete" variant="ghost" size="sm" icon={<Trash2 />} onClick={() => askToDelete("timeline", item.id, item.title)} /></HStack></article>)}</section><Button label="Open full timeline" href="/timeline" variant="primary" /></VStack> : null}

        {tab === "graph" ? <Card padding={8}><VStack gap={4} align="center"><Heading level={2}>Explore relationships spatially</Heading><Text color="secondary" justify="center">The graph is generated from the claims, evidence, sources, gaps, and relationships that remain in this project.</Text><Button label="Open evidence graph" href="/graph" variant="primary" /></VStack></Card> : null}
      </section>
      {selectedEvidence ? (
        <DetailPanel
          eyebrow="Captured evidence"
          title={selectedEvidence.extractedClaim}
          onClose={() => setSelectedEvidence(null)}
          meta={
            <>
              <Badge label={selectedEvidence.stance} variant={selectedEvidence.stance === "contradicts" ? "red" : "green"} />
              <Badge label={`${Math.round(selectedEvidence.confidence * 100)}% confidence`} />
            </>
          }
          summary={<blockquote className="detail-quote">“{selectedEvidence.selectedText}”</blockquote>}
          footer={<Button label="Open source detail" href={`/research/source/${selectedEvidence.sourceId}`} variant="primary" width="100%" />}
          tabs={[
            {
              value: "source",
              label: "Source",
              content: (
                <VStack gap={3}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary" className="detail-panel-eyebrow">Page</Text>
                    <Text>{selectedEvidence.pageTitle}</Text>
                  </VStack>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary" className="detail-panel-eyebrow">URL</Text>
                    <Text type="supporting" color="secondary">{selectedEvidence.url}</Text>
                  </VStack>
                </VStack>
              ),
            },
            {
              value: "methodology",
              label: "Methodology",
              content: <Text>{selectedEvidence.methodology}</Text>,
            },
            {
              value: "limitations",
              label: "Limitations",
              badge: selectedEvidence.limitations.length ? String(selectedEvidence.limitations.length) : undefined,
              content: selectedEvidence.limitations.length ? (
                <ul className="plain-list">
                  {selectedEvidence.limitations.map((item) => <li key={item}><Text>→ {item}</Text></li>)}
                </ul>
              ) : (
                <Text color="secondary">No limitations were extracted for this evidence item.</Text>
              ),
            },
          ]}
        />
      ) : null}
      {deletionTarget ? (
        <AlertDialog
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen && !deleting) setDeletionTarget(null); }}
          title={`Delete ${deletionTarget.kind}?`}
          description={`${deletionTarget.label}. ${deletionTarget.consequence} This action cannot be undone.`}
          actionLabel={`Delete ${deletionTarget.kind}`}
          onAction={removeRecord}
          isActionLoading={deleting}
        />
      ) : null}
    </VStack>
  );
}
