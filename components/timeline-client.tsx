"use client";

import { useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Activity, ArrowRight } from "lucide-react";
import type { Evidence, TimelineEvent } from "@thread/shared";
import { DetailPanel } from "@/components/detail-panel";

export function TimelineClient({ timeline, evidence }: { timeline: TimelineEvent[]; evidence: Evidence[] }) {
  const [selected, setSelected] = useState<TimelineEvent | null>(null);
  const byId = new Map(evidence.map((item) => [item.id, item]));
  return (
    <VStack gap={8}>
      <header className="page-header"><VStack gap={4}><HStack gap={2} align="center"><Activity /><Text type="supporting" color="secondary" className="page-eyebrow">RESEARCH TIMELINE</Text><Badge label={`${timeline.length} INFLECTION POINTS`} /></HStack><Heading level={1} type="display-3">Understanding is allowed to change.</Heading><Text className="page-question">Follow the moments when evidence strengthened a claim, exposed a contradiction, lowered confidence, or created a new research task.</Text></VStack></header>
      <ol className="timeline-list">
        {timeline.map((event) => (
          <li key={event.id}>
            <button type="button" className="timeline-row" onClick={() => setSelected(event)}>
              <HStack justify="between" gap={6} align="start" wrap="wrap">
                <VStack gap={2} maxWidth="760px"><HStack gap={2} wrap="wrap"><Badge label={new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()} variant="blue" /><Badge label={event.type.replaceAll("_", " ")} /></HStack><Heading level={3}>{event.title}</Heading><Text color="secondary">{event.description}</Text></VStack>
                <ArrowRight />
              </HStack>
            </button>
          </li>
        ))}
      </ol>
      <Card variant="muted" padding={6}><HStack justify="between" gap={6} align="center" wrap="wrap"><VStack gap={2}><Text type="supporting" color="secondary">CURRENT UNDERSTANDING</Text><Heading level={2}>{timeline.length ? `${timeline.length} recorded research changes` : "No research changes recorded yet"}</Heading></VStack><Button label="See what to investigate next" href="/next" variant="primary" /></HStack></Card>
      {selected ? (
        <DetailPanel
          eyebrow="Timeline event"
          title={selected.title}
          onClose={() => setSelected(null)}
          meta={
            <>
              <Badge label={selected.type.replaceAll("_", " ")} variant="blue" />
              <Badge label={new Date(selected.occurredAt).toLocaleDateString()} />
            </>
          }
          summary={<Text>{selected.description}</Text>}
          footer={<Button label="Open research book" href="/research" variant="primary" width="100%" />}
        >
          <VStack gap={3}>
            <Heading level={3}>Evidence active at this point</Heading>
            {selected.evidenceIds.length ? (
              <ul className="provenance-list">
                {selected.evidenceIds.map((id) => (
                  <li key={id}>
                    <VStack gap={1}>
                      <Text type="supporting" color="secondary">{id}</Text>
                      <Text>“{byId.get(id)?.selectedText}”</Text>
                    </VStack>
                  </li>
                ))}
              </ul>
            ) : (
              <Text color="secondary">This was a project-structure event without a direct evidence item.</Text>
            )}
          </VStack>
        </DetailPanel>
      ) : null}
    </VStack>
  );
}
