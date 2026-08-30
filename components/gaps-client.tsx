"use client";

import { useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ArrowRight, CircleHelp, Search } from "lucide-react";
import type { ResearchGap } from "@thread/shared";
import { DetailPanel } from "@/components/detail-panel";
import { PageIntro, SummaryBand } from "@/components/page-shell";

export function GapsClient({ gaps }: { gaps: ResearchGap[] }) {
  const [selected, setSelected] = useState<ResearchGap | null>(null);
  const largest = gaps.find((gap) => gap.isLargest) ?? gaps[0];
  const coverages = gaps.map((gap) => gap.coverage).sort((a, b) => a - b);
  const weakestCoverage = coverages[0] ?? 0;
  const medianCoverage = coverages.length ? coverages[Math.floor(coverages.length / 2)] : 0;
  const gapEvidenceCount = gaps.reduce((total, gap) => total + gap.evidenceCount, 0);
  return (
    <VStack gap={8}>
      <PageIntro
        crumbs={[{ label: "Evidence", href: "/graph" }, { label: "Knowledge gaps" }]}
        eyebrow="KNOWLEDGE GAPS"
        icon={<CircleHelp />}
        title="The empty spaces matter."
        question="Coverage is only useful when it reveals what is missing: populations, time periods, outcomes, methods, and unresolved findings."
        actions={<Button label="Plan the next inquiry" href="/next" variant="primary" size="sm" endContent={<ArrowRight />} />}
      />
      <SummaryBand
        label="Coverage summary"
        stats={[
          { label: "Open gaps", value: gaps.length, emphasis: true },
          { label: "Weakest coverage", value: `${weakestCoverage}%`, detail: largest?.topic },
          { label: "Median coverage", value: `${medianCoverage}%`, detail: "Across all tracked topics" },
          { label: "Evidence on gaps", value: gapEvidenceCount, detail: "Items touching a tracked gap" },
        ]}
      />
      {largest ? (
        <Card variant="yellow" padding={6}>
          <Grid columns={{ minWidth: 300, max: 2, repeat: "fit" }} gap={8} align="center">
            <VStack gap={4}>
              <Text type="supporting" color="secondary" className="page-eyebrow">YOUR LARGEST RESEARCH GAP</Text>
              <Heading level={2} type="display-3">{largest.topic}</Heading>
              <Text className="section-copy">{largest.whyItMatters}</Text>
              {largest.reasons?.length ? <VStack gap={2}><Text weight="semibold">Why this gap exists</Text><ul className="plain-list">{largest.reasons.slice(0, 3).map((reason) => <li key={reason}><Text>→ {reason}</Text></li>)}</ul></VStack> : null}
              <HStack gap={2} wrap="wrap"><Badge label={`${largest.evidenceCount} evidence item`} /><Badge label={`${largest.coverage}% coverage`} /></HStack>
            </VStack>
            <VStack gap={4}>
              <Text weight="semibold">Suggested investigation</Text>
              <ul className="plain-list">
                {(largest.suggestedSearches.length ? largest.suggestedSearches : largest.suggestedQuestions).map((item) => <li key={item}><Text>→ {item}</Text></li>)}
              </ul>
              <Button label="Investigate this gap" href="/next" variant="primary" endContent={<ArrowRight />} />
            </VStack>
          </Grid>
        </Card>
      ) : null}
      <section className="section-rule">
        <VStack gap={5}>
          <VStack gap={2}><Text type="supporting" color="secondary" className="page-eyebrow">RESEARCH LANDSCAPE</Text><Heading level={2}>Topic coverage</Heading></VStack>
          <ul className="coverage-tree">
            {gaps.map((gap) => (
              <li key={gap.id}>
                <button type="button" className="gap-label-button" onClick={() => setSelected(gap)}><Text weight="semibold">├── {gap.topic}</Text></button>
                <section className="coverage-track" aria-label={`${gap.topic} ${gap.coverage}% coverage`}><section className={`coverage-fill${gap.coverage < 70 ? " is-gap" : ""}`} style={{ width: `${gap.coverage}%` }} /></section>
                <HStack gap={2} align="center"><Text className="row-index">{gap.coverage}%</Text><Badge label={`${gap.evidenceCount} evidence`} /></HStack>
              </li>
            ))}
          </ul>
        </VStack>
      </section>
      <Grid columns={{ minWidth: 300, max: 3, repeat: "fit" }} gap={4}>
        {gaps.slice().sort((a, b) => a.coverage - b.coverage).slice(0, 3).map((gap) => (
          <Card key={gap.id} padding={5}>
            <VStack gap={4}>
              <HStack justify="between"><Badge label="UNDER-RESEARCHED" variant="yellow" /><Text type="supporting" color="secondary">{gap.coverage}%</Text></HStack>
              <Heading level={3}>{gap.topic}</Heading>
              <Text color="secondary">{gap.whyItMatters}</Text>
              <Button label="Inspect gap" onClick={() => setSelected(gap)} variant="ghost" endContent={<ArrowRight />} />
            </VStack>
          </Card>
        ))}
      </Grid>
      {selected ? (
        <DetailPanel
          eyebrow="Knowledge gap"
          title={selected.topic}
          onClose={() => setSelected(null)}
          meta={
            <>
              <Badge label={`${selected.coverage}% coverage`} variant="yellow" />
              <Badge label={selected.evidenceCount === 1 ? "1 evidence item" : `${selected.evidenceCount} evidence items`} />
            </>
          }
          summary={<Text>{selected.whyItMatters}</Text>}
          footer={<Button label="Open next research" href="/next" variant="primary" width="100%" />}
          tabs={[
            {
              value: "why",
              label: "Why it exists",
              content: (
                <VStack gap={4}>
                  <ul className="plain-list">
                    {(selected.reasons?.length ? selected.reasons : ["The topic does not yet have enough independent evidence, methodological detail, and counterevidence for a defensible synthesis."]).map((reason) => (
                      <li key={reason}><Text>→ {reason}</Text></li>
                    ))}
                  </ul>
                  {selected.missingDimensions?.length ? (
                    <VStack gap={2}>
                      <Text weight="semibold">Missing dimensions</Text>
                      <HStack gap={2} wrap="wrap">
                        {selected.missingDimensions.map((dimension) => <Badge key={dimension} label={dimension.toUpperCase()} variant="yellow" />)}
                      </HStack>
                    </VStack>
                  ) : null}
                </VStack>
              ),
            },
            {
              value: "questions",
              label: "Questions",
              badge: String(selected.suggestedQuestions.length),
              content: (
                <ul className="plain-list">
                  {selected.suggestedQuestions.map((question) => <li key={question}><Text>? {question}</Text></li>)}
                </ul>
              ),
            },
            {
              value: "searches",
              label: "Searches",
              badge: String(selected.suggestedSearches.length),
              content: (
                <VStack gap={3}>
                  {selected.suggestedSearches.map((query) => (
                    <article className="detail-row" key={query}>
                      <HStack gap={2} align="center"><Search /><Text maxLines={2}>{query}</Text></HStack>
                    </article>
                  ))}
                </VStack>
              ),
            },
          ]}
        />
      ) : null}
    </VStack>
  );
}
