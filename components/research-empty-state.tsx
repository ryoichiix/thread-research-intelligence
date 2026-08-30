import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ArrowRight, Network, Plus, ShieldCheck } from "lucide-react";

export function ResearchEmptyState({
  title = "Start with a real research question.",
  description = "Create your first project, then capture evidence from the web. THREAD will build the graph from your sources—nothing is preloaded or synthetic.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="empty-research-state">
      <Card padding={6}>
        <VStack gap={6} align="center">
          <Network />
          <VStack gap={3} align="center" maxWidth="680px">
            <Text type="supporting" color="secondary" className="page-eyebrow">EMPTY WORKSPACE</Text>
            <Heading level={1} type="display-3" justify="center">{title}</Heading>
            <Text color="secondary" justify="center">{description}</Text>
          </VStack>
          <HStack gap={3} wrap="wrap">
            <Button label="Create research project" href="/onboarding" variant="primary" icon={<Plus />} endContent={<ArrowRight />} />
            <Button label="Extension setup" href="/settings#extension" icon={<ShieldCheck />} />
          </HStack>
        </VStack>
      </Card>
    </section>
  );
}
