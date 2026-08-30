"use client";

import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

/*
 * One page template for every workspace destination: a slim breadcrumb, a compact title row
 * with its actions on the same line, then a dense summary band.
 *
 * The breadcrumb's first crumb is the sidebar group the page belongs to, so the trail always
 * has a real parent. The design system warns against breadcrumbs on parentless top-level
 * pages, and the sidebar grouping is what makes these pages non-parentless.
 */
export interface PageCrumb {
  label: string;
  href?: string;
}

export function PageIntro({
  crumbs,
  eyebrow,
  icon,
  title,
  question,
  actions,
}: {
  crumbs: PageCrumb[];
  eyebrow: string;
  icon?: React.ReactNode;
  title: string;
  question?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-intro">
      <VStack gap={3}>
        <Breadcrumbs variant="supporting" label={`${title} location`}>
          {crumbs.map((crumb, index) => (
            <BreadcrumbItem key={crumb.label} href={crumb.href} isCurrent={index === crumbs.length - 1}>
              {crumb.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>

        <HStack justify="between" align="end" gap={5} wrap="wrap">
          <VStack gap={2} maxWidth="760px">
            <HStack gap={2} align="center" wrap="wrap">
              {icon}
              <Text type="supporting" color="secondary" className="page-eyebrow">{eyebrow}</Text>
            </HStack>
            <Heading level={1} type="display-3">{title}</Heading>
            {question ? <Text className="page-question">{question}</Text> : null}
          </VStack>
          {actions ? <HStack gap={2} wrap="wrap" className="page-intro-actions">{actions}</HStack> : null}
        </HStack>
      </VStack>
    </header>
  );
}

export interface SummaryStat {
  label: string;
  value: string | number;
  /** One short line of context. Kept to a single line so the band stays scannable. */
  detail?: string;
  /** Draws the eye to the number that should drive the next decision. */
  emphasis?: boolean;
}

/*
 * A real grid rather than a column of Cards: the stats are peers, so they belong on one row
 * that reflows by width instead of a stack that pushes the actual content below the fold.
 */
export function SummaryBand({ stats, label = "Summary" }: { stats: SummaryStat[]; label?: string }) {
  if (!stats.length) return null;
  return (
    <section className="summary-band" aria-label={label}>
      <Grid columns={{ minWidth: 160, max: 5, repeat: "fit" }} gap={0}>
        {stats.map((stat) => (
          <VStack gap={1} key={stat.label} className="summary-cell" data-emphasis={stat.emphasis ? "true" : undefined}>
            <Text type="supporting" color="secondary" className="summary-cell-label">{stat.label}</Text>
            <Text className="summary-cell-value">{stat.value}</Text>
            {stat.detail ? <Text type="supporting" color="secondary" maxLines={1}>{stat.detail}</Text> : null}
          </VStack>
        ))}
      </Grid>
    </section>
  );
}
