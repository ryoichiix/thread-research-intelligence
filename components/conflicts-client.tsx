"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ArrowRight, BookOpen, Check, GitCompareArrows, Scale, ShieldAlert } from "lucide-react";
import { PageIntro, SummaryBand } from "@/components/page-shell";
import type { Conflict, ConflictResolutionChoice, Evidence } from "@thread/shared";

const decisionOptions: Array<{
  value: ConflictResolutionChoice;
  label: string;
  description: string;
}> = [
  {
    value: "supporting_position",
    label: "Supporting position is stronger",
    description: "Accept the supporting evidence as the working conclusion and retain the opposing material as a limitation.",
  },
  {
    value: "contradicting_position",
    label: "Contradicting position is stronger",
    description: "Reject the original position and promote the contradicting evidence to the working conclusion.",
  },
  {
    value: "context_dependent",
    label: "Both are valid in different contexts",
    description: "Keep both findings and record the population, method, condition, or definition that separates them.",
  },
  {
    value: "inconclusive",
    label: "Evidence is still inconclusive",
    description: "Close the comparison without choosing a winner and preserve the uncertainty in the report.",
  },
];

const decisionLabels: Record<ConflictResolutionChoice, string> = {
  supporting_position: "Supporting position accepted",
  contradicting_position: "Contradicting position accepted",
  context_dependent: "Context-dependent finding",
  inconclusive: "Evidence remains inconclusive",
};

function EvidenceColumn({
  label,
  tone,
  evidenceIds,
  byId,
}: {
  label: string;
  tone: "support" | "oppose";
  evidenceIds: string[];
  byId: Map<string, Evidence>;
}) {
  return (
    <article className={`resolution-evidence-column is-${tone}`}>
      <VStack gap={4}>
        <HStack justify="between" align="center" gap={3}>
          <HStack gap={2} align="center">
            {tone === "support" ? <Check /> : <GitCompareArrows />}
            <Heading level={3}>{label}</Heading>
          </HStack>
          <Text type="supporting" color="secondary">{evidenceIds.length} excerpt{evidenceIds.length === 1 ? "" : "s"}</Text>
        </HStack>
        <ul className="resolution-evidence-list">
          {evidenceIds.map((id) => {
            const item = byId.get(id);
            return (
              <li key={id}>
                <VStack gap={3}>
                  <Text className="resolution-quote">“{item?.selectedText ?? "Evidence excerpt unavailable."}”</Text>
                  <HStack justify="between" align="center" gap={3}>
                    <Text type="supporting" color="secondary" maxLines={1}>{item?.pageTitle ?? id}</Text>
                    <Text type="supporting" color="secondary">{Math.round((item?.confidence ?? 0) * 100)}%</Text>
                  </HStack>
                </VStack>
              </li>
            );
          })}
        </ul>
      </VStack>
    </article>
  );
}

export function ConflictsClient({ conflicts, evidence }: { conflicts: Conflict[]; evidence: Evidence[] }) {
  const router = useRouter();
  const [localConflicts, setLocalConflicts] = useState(conflicts);
  const [selectedId, setSelectedId] = useState(conflicts[0]?.id ?? "");
  const [choice, setChoice] = useState<ConflictResolutionChoice | "">("");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = localConflicts.find((conflict) => conflict.id === selectedId) ?? localConflicts[0];
  const byId = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const unresolved = localConflicts.filter((item) => item.resolution === "unresolved").length;
  const resolved = localConflicts.length - unresolved;
  const resolutionPercent = localConflicts.length ? Math.round((resolved / localConflicts.length) * 100) : 0;

  const selectConflict = (id: string) => {
    setSelectedId(id);
    setChoice("");
    setRationale("");
    setMessage("");
  };

  const finalize = async () => {
    if (!selected || !choice || rationale.trim().length < 12) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/projects/${selected.projectId}/conflicts/${encodeURIComponent(selected.id)}/resolve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ choice, rationale }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The decision could not be finalized.");
      const resolvedConflict = payload.conflict as Conflict;
      setLocalConflicts((items) => items.map((item) => item.id === selected.id ? resolvedConflict : item));
      setSelectedId(resolvedConflict.id);
      setMessage("Decision finalized. Research health and the timeline now reflect this resolution.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The decision could not be finalized.");
    } finally {
      setSaving(false);
    }
  };

  if (!selected) return null;

  return (
    <VStack gap={0} className="resolution-desk">
      <PageIntro
        crumbs={[{ label: "Evidence", href: "/graph" }, { label: "Contradictions" }]}
        eyebrow="DECISION DESK / CONTRADICTIONS"
        icon={<ShieldAlert />}
        title="Resolve what the evidence cannot."
        question="Compare both positions, record your reasoning, and turn an unresolved clash into an explicit research decision."
        actions={<Button label="Investigate before deciding" href="/next" endContent={<ArrowRight />} size="sm" />}
      />
      <SummaryBand
        label="Contradiction summary"
        stats={[
          { label: "Open decisions", value: unresolved, detail: "Awaiting your judgement", emphasis: unresolved > 0 },
          { label: "Finalized", value: resolved, detail: "Recorded with a rationale" },
          { label: "Resolution", value: `${resolutionPercent}%`, detail: "Of all detected contradictions" },
        ]}
      />

      <section className="resolution-workspace">
        <aside className="resolution-queue" aria-label="Contradiction queue">
          <HStack justify="between" align="center" className="resolution-queue-header">
            <VStack gap={1}>
              <Text type="supporting" color="secondary" className="page-eyebrow">QUEUE</Text>
              <Heading level={2}>Decisions</Heading>
            </VStack>
            <Badge label={`${localConflicts.length}`} />
          </HStack>
          <section className="resolution-queue-list">
            {localConflicts.map((conflict, index) => (
              <button
                key={conflict.id}
                type="button"
                className={`resolution-queue-row${selected.id === conflict.id ? " is-selected" : ""}`}
                onClick={() => selectConflict(conflict.id)}
              >
                <HStack gap={3} align="start">
                  <Text className="row-index">{String(index + 1).padStart(2, "0")}</Text>
                  <VStack gap={2}>
                    <HStack gap={2} align="center" wrap="wrap">
                      <StatusDot variant={conflict.resolution === "resolved" ? "success" : conflict.severity === "major" ? "error" : "warning"} label={conflict.resolution} />
                      <Text type="supporting" weight="semibold">{conflict.resolution === "resolved" ? "FINALIZED" : conflict.severity.toUpperCase()}</Text>
                    </HStack>
                    <Text weight="semibold">{conflict.title}</Text>
                    <Text type="supporting" color="secondary">{conflict.topic} · {Math.round(conflict.confidence * 100)}%</Text>
                  </VStack>
                </HStack>
              </button>
            ))}
          </section>
        </aside>

        <section className="resolution-case">
          <VStack gap={6}>
            <VStack gap={2} className="resolution-case-title">
              <HStack gap={2} align="center" wrap="wrap">
                <Badge label={selected.status.replaceAll("_", " ")} variant={selected.resolution === "resolved" ? "green" : "red"} />
                <Text type="supporting" color="secondary">{selected.topic}</Text>
              </HStack>
              <Heading level={2}>{selected.title}</Heading>
            </VStack>

            <section className="resolution-comparison" aria-label="Side-by-side evidence comparison">
              <EvidenceColumn label="Position A" tone="support" evidenceIds={selected.supportingEvidence} byId={byId} />
              <EvidenceColumn label="Position B" tone="oppose" evidenceIds={selected.contradictingEvidence} byId={byId} />
            </section>

            <section className="resolution-context">
              <VStack gap={3}>
                <HStack gap={2} align="center"><Scale /><Heading level={3}>Why they may disagree</Heading></HStack>
                <ul className="resolution-reasons">
                  {selected.explanation.filter((reason) => !/^Resolution (decision|rationale): |^Resolved at: /.test(reason)).map((reason) => <li key={reason}><Text>{reason}</Text></li>)}
                </ul>
              </VStack>
            </section>

            {selected.resolution === "resolved" && selected.resolutionChoice ? (
              <section className="resolution-receipt">
                <VStack gap={4}>
                  <HStack justify="between" align="start" gap={4} wrap="wrap">
                    <HStack gap={2} align="center"><Check /><Heading level={3}>Final decision</Heading></HStack>
                    <StatusDot variant="success" label="Finalized" />
                  </HStack>
                  <Heading level={2}>{decisionLabels[selected.resolutionChoice]}</Heading>
                  <Text>{selected.resolutionRationale}</Text>
                  <Text type="supporting" color="secondary">Recorded {selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleString() : "in the research timeline"}.</Text>
                  <Button label="Open research timeline" href="/timeline" icon={<BookOpen />} size="sm" />
                </VStack>
              </section>
            ) : (
              <section className="resolution-form">
                <VStack gap={5}>
                  <VStack gap={1}>
                    <Text type="supporting" weight="semibold" className="page-eyebrow">FINAL DECISION</Text>
                    <Heading level={2}>What should the research conclude?</Heading>
                    <Text color="secondary">Choose one outcome. Your rationale will appear in the timeline and structured report.</Text>
                  </VStack>
                  <RadioList
                    label="Resolution outcome"
                    value={choice}
                    onChange={(value) => setChoice(value as ConflictResolutionChoice)}
                    orientation="vertical"
                    isRequired
                  >
                    {decisionOptions.map((option) => (
                      <RadioListItem key={option.value} value={option.value} label={option.label} description={option.description} />
                    ))}
                  </RadioList>
                  <TextArea
                    label="Decision rationale"
                    description="State why this outcome is more defensible, including the method, population, condition, or source-quality difference that matters."
                    value={rationale}
                    onChange={setRationale}
                    placeholder="Example: Position A used a longitudinal field study, while Position B relied on a small laboratory sample…"
                    rows={4}
                    maxLength={1200}
                    isRequired
                    width="100%"
                    status={rationale.length > 0 && rationale.trim().length < 12 ? { type: "warning", message: "Add a little more reasoning before finalizing." } : undefined}
                  />
                  <HStack justify="between" align="center" gap={4} wrap="wrap" className="resolution-commit-row">
                    <Text type="supporting" color="secondary">Finalizing updates research health and creates a permanent timeline entry.</Text>
                    <Button
                      label="Finalize resolution"
                      variant="primary"
                      icon={<Check />}
                      onClick={finalize}
                      isLoading={saving}
                      isDisabled={!choice || rationale.trim().length < 12}
                    />
                  </HStack>
                  {message ? <Text type="supporting" color="secondary" className={message.startsWith("Decision finalized") ? "resolution-message is-success" : "resolution-message is-error"}>{message}</Text> : null}
                </VStack>
              </section>
            )}
          </VStack>
        </section>
      </section>
    </VStack>
  );
}
