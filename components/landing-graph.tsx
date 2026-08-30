"use client";

import { useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

const nodes = [
  { id: "q", x: 50, y: 48, label: "Research question", kind: "QUESTION", tone: "question" },
  { id: "c1", x: 25, y: 23, label: "Faster bounded tasks", kind: "CLAIM", tone: "claim" },
  { id: "c2", x: 76, y: 24, label: "Quality needs review", kind: "CLAIM", tone: "claim" },
  { id: "e1", x: 12, y: 60, label: "18% time reduction", kind: "EVIDENCE", tone: "evidence" },
  { id: "e2", x: 88, y: 50, label: "No complex-task gain", kind: "CONFLICT", tone: "conflict" },
  /*
   * The bottom-right quadrant is deliberately left empty: the detail card is anchored there, and
   * with the old positions it landed straight on top of the SOURCE node. Every corner collided
   * with some node before this, so the fix is to make clear space rather than pick a better corner.
   */
  { id: "g1", x: 24, y: 76, label: "Long-term effects", kind: "GAP", tone: "gap" },
  { id: "s1", x: 55, y: 74, label: "Enterprise evidence", kind: "SOURCE", tone: "source" },
];

const edges = [
  ["q", "c1"], ["q", "c2"], ["c1", "e1"], ["c2", "e2"], ["q", "g1"], ["q", "s1"], ["e1", "g1"], ["e2", "s1"],
];

export function LandingGraph() {
  const [selected, setSelected] = useState(nodes[0]);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (
    <section className="landing-graph" aria-label="Interactive research graph preview">
      <svg className="landing-graph-lines" viewBox="0 0 100 100" aria-hidden="true">
        {edges.map(([from, to], index) => {
          const start = byId.get(from)!;
          const end = byId.get(to)!;
          return (
            <line
              key={`${from}-${to}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className={index === 3 ? "graph-line graph-line-conflict" : "graph-line"}
            />
          );
        })}
      </svg>
      {nodes.map((node, index) => (
        <button
          type="button"
          key={node.id}
          className={`landing-node landing-node-${node.tone}${selected.id === node.id ? " is-selected" : ""}`}
          style={{ left: `${node.x}%`, top: `${node.y}%`, animationDelay: `calc(var(--duration-fast) * ${index})` }}
          onClick={() => setSelected(node)}
          aria-pressed={selected.id === node.id}
        >
          <small>{node.kind}</small>
          <strong>{node.label}</strong>
        </button>
      ))}
      <aside className="landing-graph-detail">
        <VStack gap={2}>
          <HStack gap={2} align="center">
            <Badge label={selected.kind} />
            <Text type="supporting" color="secondary">SELECTED NODE</Text>
          </HStack>
          <Text weight="semibold">{selected.label}</Text>
          <Text color="secondary">
            Click any node to inspect how THREAD connects questions, evidence, claims, conflicts, and gaps.
          </Text>
        </VStack>
      </aside>
    </section>
  );
}
