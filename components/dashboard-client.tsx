"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ArrowRight, Download, GitFork, Search, Sparkles } from "lucide-react";
import type { DashboardSummary, Evidence, Insight, TimelineEvent } from "@thread/shared";
import { DetailPanel } from "@/components/detail-panel";

const insightBadges: Record<
  Insight["type"],
  { label: string; variant: "blue" | "red" | "yellow" | "green" | "purple" | "teal" }
> = {
  EMERGING_PATTERN: { label: "Pattern", variant: "blue" },
  CONTRADICTION: { label: "Contradiction", variant: "red" },
  KNOWLEDGE_GAP: { label: "Knowledge gap", variant: "yellow" },
  SIGNIFICANT_FINDING: { label: "Finding", variant: "green" },
  WEAK_EVIDENCE: { label: "Weak evidence", variant: "purple" },
  NEW_CONNECTION: { label: "Connection", variant: "teal" },
};

const readinessLabels: Record<DashboardSummary["health"]["stage"], string> = {
  not_started: "Not started",
  exploratory: "Exploratory",
  developing: "Developing",
  substantial: "Substantial",
  near_review_ready: "Near review-ready",
  ready_for_review: "Ready for expert review",
};

function ResearchTrendChart({
  points,
  valueKey,
  maxValue,
  label,
  area = false,
}: {
  points: Array<{ label: string } & Record<string, string | number>>;
  valueKey: string;
  maxValue: number;
  label: string;
  area?: boolean;
}) {
  const width = 640;
  const height = 176;
  const left = 38;
  const right = width - 12;
  const top = 14;
  const bottom = height - 34;
  const chartPoints =
    points.length === 1
      ? [{ ...points[0]!, label: "Start", [valueKey]: 0 }, points[0]!]
      : points;
  const safeMax = Math.max(maxValue, 1);
  const coordinates = chartPoints.map((point, index) => {
    const x = left + ((right - left) * index) / Math.max(chartPoints.length - 1, 1);
    const value = Number(point[valueKey] ?? 0);
    const y = bottom - (Math.min(Math.max(value, 0), safeMax) / safeMax) * (bottom - top);
    return { x, y, value, pointLabel: point.label };
  });
  const linePath = coordinates.map(({ x, y }, index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const areaPath = `${linePath} L ${right} ${bottom} L ${left} ${bottom} Z`;
  const labelIndexes = [...new Set([0, Math.floor((coordinates.length - 1) / 2), coordinates.length - 1])];
  const latest = coordinates.at(-1);

  return (
    <svg className="research-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {[safeMax, safeMax / 2, 0].map((value, index) => {
        const y = top + ((bottom - top) * index) / 2;
        return (
          <g key={`${value}-${index}`}>
            <line className="research-chart-grid" x1={left} x2={right} y1={y} y2={y} />
            <text className="research-chart-label research-chart-label-y" x={left - 9} y={y + 4}>{Math.round(value)}</text>
          </g>
        );
      })}
      {area ? <path className="research-chart-area" d={areaPath} /> : null}
      <path className="research-chart-line" d={linePath} />
      {coordinates.map(({ x, y, value, pointLabel }) => (
        <circle className="research-chart-point" cx={x} cy={y} r="3" key={`${pointLabel}-${x}`}>
          <title>{`${pointLabel}: ${value}`}</title>
        </circle>
      ))}
      {labelIndexes.map((index) => {
        const point = coordinates[index]!;
        const anchor = index === 0 ? "start" : index === coordinates.length - 1 ? "end" : "middle";
        return <text className="research-chart-label" key={`${point.pointLabel}-${index}`} x={point.x} y={height - 10} textAnchor={anchor}>{point.pointLabel}</text>;
      })}
      {latest ? <text className="research-chart-current" x={latest.x - 7} y={Math.max(latest.y - 9, top)} textAnchor="end">{latest.value}</text> : null}
    </svg>
  );
}

export function DashboardClient({
  summary,
  evidence,
  timeline,
}: {
  summary: DashboardSummary;
  evidence: Evidence[];
  timeline: TimelineEvent[];
}) {
  const router = useRouter();
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const filteredInsights = useMemo(
    () => summary.insights.filter((insight) =>
      `${insight.title} ${insight.description} ${insight.type}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [query, summary.insights],
  );
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const healthMetrics = [
    ["Evidence depth", summary.health.evidenceDepth],
    ["Source credibility", summary.health.sourceQuality],
    ["Source diversity", summary.health.sourceDiversity],
    ["Methodological rigor", summary.health.methodologicalRigor],
    ["Contradiction testing", summary.health.contradictionTesting],
    ["Citation completeness", summary.health.citationCompleteness],
    ["Aspect coverage", summary.health.aspectCoverage],
  ] as const;
  const weakestHealth = healthMetrics.slice().sort((left, right) => left[1] - right[1])[0];
  const aspectAttention = summary.health.aspectAudit.filter((aspect) => aspect.status !== "covered");
  const researchAudit = [
    {
      question: "Is the research perfect?",
      answer: "No research is final",
      description: summary.health.verdicts.perfect,
      status: "neutral" as const,
    },
    {
      question: "Is it complete enough to review?",
      answer: summary.health.isComplete ? "Yes — expert review" : `Not yet — ${summary.health.completion}%`,
      description: summary.health.verdicts.completed,
      status: summary.health.isComplete ? "success" as const : "warning" as const,
    },
    {
      question: "Were all topic aspects tested?",
      answer: `${summary.health.coveredAspects} of ${summary.health.totalAspects} covered`,
      description: summary.health.verdicts.coverage,
      status: summary.health.missingAspects.length ? "warning" as const : "success" as const,
    },
  ];
  const updatedLabel = new Date(summary.project.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const generate = async () => {
    setGenerating(true);
    setGenerationMessage("");
    try {
      const response = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: summary.project.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Insight generation failed.");
      setGenerationMessage("Grounded insight generated and saved.");
      router.refresh();
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : "Insight generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const ledgerHeader = (
    <HStack justify="between" align="end" gap={5} wrap="wrap" className="workbench-list-header">
      <VStack gap={1}>
        <Text type="supporting" color="secondary" className="workbench-kicker">EVIDENCE SYNTHESIS</Text>
        <Heading level={2}>Current findings</Heading>
      </VStack>
      <HStack gap={2} align="center" wrap="wrap">
        <Button label="Synthesize" icon={<Sparkles />} onClick={generate} isLoading={generating} size="sm" />
        <TextInput
          label="Filter insights"
          isLabelHidden
          value={query}
          onChange={setQuery}
          placeholder="Filter insights"
          startIcon={<Search />}
          hasClear
          width={220}
        />
      </HStack>
    </HStack>
  );

  return (
    <VStack gap={0} className="research-workbench">
      <Section padding={6} dividers={["bottom"]}>
        <VStack gap={6}>
          <HStack justify="between" align="start" gap={6} wrap="wrap">
            <VStack gap={2} maxWidth="820px">
              <HStack gap={3} align="center" wrap="wrap">
                <Text type="supporting" weight="semibold" className="workbench-kicker">WORKING PAPER</Text>
                <Text type="supporting" color="secondary">FILE {summary.project.id.slice(0, 8).toUpperCase()}</Text>
                <Text type="supporting" color="secondary">UPDATED {updatedLabel.toUpperCase()}</Text>
              </HStack>
              <Heading level={1} type="display-3">{summary.project.title}</Heading>
              <Text className="workbench-question">{summary.project.researchQuestion}</Text>
            </VStack>
            <HStack gap={2} wrap="wrap">
              <Button label="Export" href={`/api/reports/${summary.project.id}`} icon={<Download />} size="sm" />
              <Button label="Evidence graph" href="/graph" icon={<GitFork />} size="sm" />
              <Button label="Investigate next" href="/next" variant="primary" endContent={<ArrowRight />} size="sm" />
            </HStack>
          </HStack>

          <HStack gap={0} className="workbench-facts" wrap="wrap" aria-label="Research inventory">
            {[
              [summary.counts.sources, "Sources"],
              [summary.counts.evidence, "Evidence"],
              [summary.counts.claims, "Claims"],
              [summary.counts.conflicts, "Contradictions"],
              [summary.counts.gaps, "Open gaps"],
            ].map(([value, label]) => (
              <VStack gap={1} className="workbench-fact" key={label}>
                <Text className="workbench-fact-value">{value}</Text>
                <Text type="supporting" color="secondary">{label}</Text>
              </VStack>
            ))}
          </HStack>
        </VStack>
      </Section>

      <Section variant="muted" padding={5} dividers={["bottom"]}>
        <HStack justify="between" align="center" gap={6} wrap="wrap" className="workbench-condition">
          <HStack gap={4} align="center">
            <Text className="workbench-score">{summary.health.overall}</Text>
            <VStack gap={1}>
              <HStack gap={2} align="center">
                <StatusDot variant={summary.health.isComplete ? "success" : "warning"} label={readinessLabels[summary.health.stage]} />
                <Text weight="semibold">{readinessLabels[summary.health.stage]}</Text>
              </HStack>
              <Text color="secondary">Research condition · scored against review-readiness gates</Text>
            </VStack>
          </HStack>
          <HStack gap={5} align="center" wrap="wrap">
            <VStack gap={1} maxWidth="360px">
              <Text type="supporting" color="secondary" className="workbench-kicker">LIMITING FACTOR</Text>
              <Text weight="semibold">{weakestHealth[0]} · {weakestHealth[1]}%</Text>
            </VStack>
            <Button label="Prioritize next gap" href="/next" variant="primary" endContent={<ArrowRight />} size="sm" />
          </HStack>
        </HStack>
      </Section>

      <Layout
        height="auto"
        content={
          <LayoutContent padding={0} isScrollable={false} label="Research dashboard">
            <VStack gap={0}>
              <Section id="insights" padding={0} dividers={["bottom"]}>
                <List header={ledgerHeader} density="balanced" hasDividers>
                  {!filteredInsights.length ? (
                    <ListItem label="No findings generated yet" description="Capture evidence or run synthesis to begin the findings list." />
                  ) : null}
                  {filteredInsights.slice(0, 8).map((insight, index) => {
                    const style = insightBadges[insight.type];
                    return (
                      <ListItem
                        key={insight.id}
                        label={insight.title}
                        onClick={() => setSelectedInsight(insight)}
                        startContent={<Text className="workbench-row-index">{String(index + 1).padStart(2, "0")}</Text>}
                        description={
                          <VStack gap={2}>
                            <Badge label={style.label} variant={style.variant} />
                            <Text color="secondary" maxLines={2}>{insight.description}</Text>
                          </VStack>
                        }
                        endContent={
                          <HStack gap={2} align="center">
                            <Text type="supporting" color="secondary">{Math.round(insight.confidence * 100)}%</Text>
                            <ArrowRight />
                          </HStack>
                        }
                      />
                    );
                  })}
                </List>
                {generationMessage ? <Text type="supporting" color="secondary" className="workbench-note">{generationMessage}</Text> : null}
              </Section>

              <Section id="health" padding={6} dividers={["bottom"]}>
                <VStack gap={5}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary" className="workbench-kicker">RESEARCH MOVEMENT</Text>
                    <Heading level={2}>Evidence and readiness over time</Heading>
                  </VStack>
                  <Grid columns={{ minWidth: 320, max: 2, repeat: "fit" }} gap={5}>
                    <figure className="workbench-figure">
                      <VStack gap={4}>
                        <HStack justify="between" align="end">
                          <VStack gap={1}>
                            <Heading level={3}>Evidence growth</Heading>
                            <Text type="supporting" color="secondary">Cumulative captured material</Text>
                          </VStack>
                          <Text className="workbench-figure-value">{summary.counts.evidence}</Text>
                        </HStack>
                        <ResearchTrendChart
                          points={summary.evidenceGrowth}
                          valueKey="evidence"
                          maxValue={Math.max(...summary.evidenceGrowth.map((point) => point.evidence), 1)}
                          label="Cumulative evidence captures over time"
                          area
                        />
                        <figcaption>Shows whether the evidence base is still widening or has stalled.</figcaption>
                      </VStack>
                    </figure>
                    <figure className="workbench-figure">
                      <VStack gap={4}>
                        <HStack justify="between" align="end">
                          <VStack gap={1}>
                            <Heading level={3}>Health over time</Heading>
                            <Text type="supporting" color="secondary">Score after evidence changes</Text>
                          </VStack>
                          <Text className="workbench-figure-value">{summary.health.overall}</Text>
                        </HStack>
                        <ResearchTrendChart points={summary.healthTrend} valueKey="score" maxValue={100} label="Research health over time" />
                        <figcaption>Only evidence, coverage, and validation changes can move this score.</figcaption>
                      </VStack>
                    </figure>
                  </Grid>
                </VStack>
              </Section>

              <Section padding={0}>
                <List
                  density="compact"
                  hasDividers
                  header={
                    <HStack justify="between" align="center" className="workbench-list-header">
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary" className="workbench-kicker">FIELD NOTES</Text>
                        <Heading level={2}>Latest research activity</Heading>
                      </VStack>
                      <Button label="Open timeline" href="/timeline" variant="ghost" size="sm" />
                    </HStack>
                  }
                >
                  {timeline.slice().reverse().slice(0, 5).map((event) => (
                    <ListItem
                      key={event.id}
                      label={event.title}
                      href="/timeline"
                      startContent={<Badge label={event.type.replaceAll("_", " ")} />}
                      description={event.description}
                      endContent={<Text type="supporting" color="secondary">{new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>}
                    />
                  ))}
                </List>
              </Section>
            </VStack>
          </LayoutContent>
        }
        end={
          <LayoutPanel width={360} padding={0} hasDivider isScrollable={false} label="Research review">
            <VStack gap={0}>
              <Section padding={0} dividers={["bottom"]}>
                <List
                  density="compact"
                  hasDividers
                  header={
                    <VStack gap={1} className="workbench-rail-header">
                      <Text type="supporting" color="secondary" className="workbench-kicker">QUALITY REVIEW</Text>
                      <Heading level={2}>Review readiness</Heading>
                    </VStack>
                  }
                >
                  {researchAudit.map((item) => (
                    <ListItem
                      key={item.question}
                      label={item.question}
                      description={
                        <VStack gap={1}>
                          <Text weight="semibold">{item.answer}</Text>
                          <Text type="supporting" color="secondary" maxLines={3}>{item.description}</Text>
                        </VStack>
                      }
                      endContent={<StatusDot variant={item.status} label={item.answer} />}
                    />
                  ))}
                </List>
              </Section>

              <Section padding={5} dividers={["bottom"]}>
                <VStack gap={4}>
                  <HStack justify="between" align="center">
                    <Heading level={3}>Readiness inputs</Heading>
                    <Text type="supporting" color="secondary">LIVE</Text>
                  </HStack>
                  {healthMetrics.map(([label, value]) => (
                    <ProgressBar key={label} value={value} label={label} hasValueLabel variant={value < 70 ? "warning" : "accent"} />
                  ))}
                </VStack>
              </Section>

              <Section padding={0}>
                <List
                  density="compact"
                  hasDividers
                  header={
                    <HStack justify="between" align="center" className="workbench-rail-header">
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary" className="workbench-kicker">COVERAGE DEBT</Text>
                        <Heading level={3}>Aspects needing evidence</Heading>
                      </VStack>
                      <Text type="supporting" color="secondary">{aspectAttention.length} OPEN</Text>
                    </HStack>
                  }
                >
                  {(aspectAttention.length ? aspectAttention : summary.health.aspectAudit).slice(0, 5).map((aspect) => (
                    <ListItem
                      key={aspect.key}
                      label={aspect.label}
                      description={
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">{aspect.sourceCount} sources · {aspect.status}</Text>
                          <Text type="supporting" color="secondary" maxLines={2}>{aspect.whyItMatters}</Text>
                        </VStack>
                      }
                      endContent={<Text type="supporting" color="secondary">{aspect.score}%</Text>}
                    />
                  ))}
                </List>
                <VStack gap={2} className="workbench-rail-action">
                  <Button label="Review all knowledge gaps" href="/gaps" width="100%" />
                  <Button label="Plan the next inquiry" href="/next" variant="primary" endContent={<ArrowRight />} width="100%" />
                </VStack>
              </Section>
            </VStack>
          </LayoutPanel>
        }
      />

      {selectedInsight ? (
        <DetailPanel
          eyebrow={insightBadges[selectedInsight.type].label}
          title={selectedInsight.title}
          onClose={() => setSelectedInsight(null)}
          meta={
            <>
              <Badge label={insightBadges[selectedInsight.type].label} variant={insightBadges[selectedInsight.type].variant} />
              <Badge label={`${Math.round(selectedInsight.confidence * 100)}% confidence`} />
            </>
          }
          summary={
            <VStack gap={3}>
              <Text>{selectedInsight.description}</Text>
              <VStack gap={1}>
                <Text type="supporting" color="secondary" className="detail-panel-eyebrow">Recommended action</Text>
                <Text weight="semibold">{selectedInsight.recommendedAction}</Text>
              </VStack>
            </VStack>
          }
          footer={
            <Button
              label={selectedInsight.type === "CONTRADICTION" ? "Open contradiction" : "Investigate this finding"}
              href={selectedInsight.type === "CONTRADICTION" ? "/conflicts" : "/next"}
              variant="primary"
              endContent={<ArrowRight />}
              width="100%"
            />
          }
          tabs={[
            {
              value: "supporting",
              label: "Supporting",
              badge: String(selectedInsight.supportingEvidence.length),
              content: selectedInsight.supportingEvidence.length ? (
                <ul className="provenance-list">
                  {selectedInsight.supportingEvidence.map((id) => {
                    const item = evidenceById.get(id);
                    return (
                      <li key={id}>
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">{id} · {item?.pageTitle}</Text>
                          <Text>“{item?.selectedText}”</Text>
                        </VStack>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Text color="secondary">This insight was generated without direct supporting evidence IDs.</Text>
              ),
            },
            {
              value: "contradicting",
              label: "Contradicting",
              badge: String(selectedInsight.contradictingEvidence.length),
              content: selectedInsight.contradictingEvidence.length ? (
                <ul className="provenance-list">
                  {selectedInsight.contradictingEvidence.map((id) => (
                    <li key={id}>
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">{id} · {evidenceById.get(id)?.pageTitle}</Text>
                        <Text>“{evidenceById.get(id)?.selectedText}”</Text>
                      </VStack>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text color="secondary">Nothing captured so far contradicts this finding.</Text>
              ),
            },
          ]}
        />
      ) : null}
    </VStack>
  );
}
