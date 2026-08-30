"use client";

import dynamic from "next/dynamic";
import { Card } from "@astryxdesign/core/Card";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import type { Evidence, GraphAnalysis, GraphEdge, GraphNode } from "@thread/shared";

const GraphClient = dynamic(() => import("@/components/graph-client").then((module) => module.GraphClient), {
  ssr: false,
  loading: () => <Card padding={6} minHeight={620}><Skeleton height={560} /></Card>,
});

export function GraphLoader(props: { graph: { nodes: GraphNode[]; edges: GraphEdge[]; analysis: GraphAnalysis }; evidence: Evidence[] }) {
  return <GraphClient {...props} />;
}
