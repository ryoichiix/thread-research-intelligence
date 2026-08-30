import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { ArrowRight, PanelRightOpen, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { HeroThread } from "@/components/hero-thread";
import { LandingGraph } from "@/components/landing-graph";

export default function LandingPage() {
  const topNav = (
    <TopNav
      label="Public navigation"
      heading={<TopNavHeading logo={<BrandMark compact />} heading="THREAD" headingHref="/" />}
      startContent={
        <>
          <TopNavItem label="Product" href="#product" />
          <TopNavItem label="Intelligence" href="#intelligence" />
          <TopNavItem label="Extension" href="#extension" />
        </>
      }
      endContent={
        <HStack gap={2} align="center">
          <Button label="Open workspace" href="/dashboard" variant="primary" endContent={<ArrowRight />} />
        </HStack>
      }
    />
  );

  return (
    <AppShell topNav={topNav} height="auto" variant="surface" contentPadding={0}>
      <VStack>
        <section className="landing-hero">
          <VStack gap={8} align="center">
            <HeroThread />
            <HStack gap={2} align="center">
              <StatusDot variant="success" label="Production ready" isPulsing />
              <Text type="supporting" color="secondary">RESEARCH INTELLIGENCE, NOT ANOTHER NOTE APP</Text>
            </HStack>
            <VStack gap={4} align="center" maxWidth="900px">
              <Heading level={1} type="display-1" justify="center">Your research should remember what you read.</Heading>
              <Text className="hero-copy" justify="center">
                Turn scattered sources into a living evidence graph that connects claims, exposes contradictions,
                reveals knowledge gaps, and shows you what to investigate next.
              </Text>
            </VStack>
            <HStack gap={3} wrap="wrap" justify="center">
              <Button label="Start research" href="/onboarding" variant="primary" size="lg" endContent={<ArrowRight />} />
              <Button label="Download extension" href="/thread-extension.zip" size="lg" icon={<PanelRightOpen />} />
              <Button label="Open workspace" href="/dashboard" size="lg" variant="ghost" />
            </HStack>
            <LandingGraph />
          </VStack>
        </section>

        <section id="product" className="landing-section landing-proof">
          <VStack gap={8}>
            <HStack gap={6} align="end" justify="between" wrap="wrap">
              <VStack gap={2} maxWidth="680px">
                <Text type="supporting" color="secondary">THE RESEARCH LOOP</Text>
                <Heading level={2} type="display-3">From a highlighted sentence to a defensible next question.</Heading>
              </VStack>
              <Badge label="Every conclusion keeps its evidence IDs" variant="success" />
            </HStack>
            <ol className="research-loop">
              {[
                ["01", "Capture", "Save selected evidence with page context and metadata."],
                ["02", "Understand", "Extract the claim, stance, method, and limitations."],
                ["03", "Connect", "Link claims to supporting, expanding, and dependent evidence."],
                ["04", "Compare", "Separate genuine contradictions from methodological tension."],
                ["05", "Discover", "Surface patterns, weak evidence, and missing populations."],
                ["06", "Investigate", "Rank the questions most likely to improve research health."],
              ].map(([number, title, description]) => (
                <li key={number}>
                  <Text type="supporting" color="secondary">{number}</Text>
                  <Heading level={3}>{title}</Heading>
                  <Text color="secondary">{description}</Text>
                </li>
              ))}
            </ol>
          </VStack>
        </section>

        <section id="intelligence" className="landing-section landing-intelligence">
          <Grid columns={{ minWidth: 300, max: 3, repeat: "fit" }} gap={4}>
            <Card padding={6}>
              <VStack gap={5}>
                <ScanSearch />
                <Heading level={3}>Contradiction radar</Heading>
                <Text color="secondary">See exactly which findings disagree and why population, method, or task complexity may explain it.</Text>
                <Button label="Open the radar" href="/conflicts" variant="ghost" endContent={<ArrowRight />} />
              </VStack>
            </Card>
            <Card padding={6}>
              <VStack gap={5}>
                <Sparkles />
                <Heading level={3}>Insight engine</Heading>
                <Text color="secondary">Patterns are generated only when supporting evidence IDs survive schema and provenance validation.</Text>
                <Button label="Inspect insights" href="/dashboard#insights" variant="ghost" endContent={<ArrowRight />} />
              </VStack>
            </Card>
            <Card padding={6}>
              <VStack gap={5}>
                <ShieldCheck />
                <Heading level={3}>Research health</Heading>
                <Text color="secondary">Coverage, source quality, agreement, topical breadth, and recency make confidence transparent.</Text>
                <Button label="View research health" href="/dashboard#health" variant="ghost" endContent={<ArrowRight />} />
              </VStack>
            </Card>
          </Grid>
        </section>

        <section id="extension" className="landing-section extension-band">
          <Grid columns={{ minWidth: 320, max: 2, repeat: "fit" }} gap={10} align="center">
            <VStack gap={5}>
              <Text type="supporting" color="secondary">CHROME SIDE PANEL</Text>
              <Heading level={2} type="display-3">The intelligence layer travels with the browser.</Heading>
              <Text className="section-copy">
                Highlight a claim, save it with provenance, explain it in context, or verify it against everything already inside your project.
              </Text>
              <HStack gap={3} wrap="wrap">
                <Button label="Download extension" href="/thread-extension.zip" variant="primary" />
                <Button label="Open workspace" href="/dashboard" />
              </HStack>
            </VStack>
            <article className="extension-preview">
              <VStack gap={4}>
                <HStack justify="between" align="center">
                  <HStack gap={2} align="center"><BrandMark compact /><Text weight="semibold">THREAD</Text></HStack>
                  <Badge label="CONNECTED" variant="success" />
                </HStack>
                <Text type="supporting" color="secondary">VERIFY AGAINST THREAD</Text>
                <blockquote>Your selected evidence appears here with its source and surrounding context.</blockquote>
                <Card variant="muted" padding={4}>
                  <VStack gap={2}>
                    <Text weight="semibold">Ready to analyze</Text>
                    <Text>Save, explain, or verify against your chosen research project.</Text>
                  </VStack>
                </Card>
                <Button label="View strongest conflicting evidence" href="/conflicts" width="100%" />
              </VStack>
            </article>
          </Grid>
        </section>

        <footer className="landing-footer">
          <HStack justify="between" align="center" wrap="wrap" gap={4}>
            <HStack gap={2} align="center"><BrandMark compact /><Text weight="semibold">THREAD</Text></HStack>
            <Text color="secondary">Capture → Evidence → Connections → Patterns → Gaps → Next research</Text>
            <Button label="Launch THREAD" href="/dashboard" variant="primary" />
          </HStack>
        </footer>
      </VStack>
    </AppShell>
  );
}
