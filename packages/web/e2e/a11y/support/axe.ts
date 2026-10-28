import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

export interface AxeSummary {
  readonly counts: Readonly<Record<string, number>>;
  readonly blocking: readonly string[];
}

/**
 * Runs axe (WCAG 2.0/2.1/2.2 A and AA plus best practices) and summarises it: a count per impact
 * and one line per serious or critical violation. Attached to the test as JSON for the report.
 */
export async function runAxe(page: Page, testInfo: TestInfo): Promise<AxeSummary> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const violation of violations) {
    const impact = violation.impact ?? 'minor';
    counts[impact] = (counts[impact] ?? 0) + violation.nodes.length;
  }
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? ''}): ${violation.nodes
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    );
  await testInfo.attach('axe-summary.json', {
    body: JSON.stringify({ counts, violations: violations.map(toRow) }, null, 2),
    contentType: 'application/json',
  });

  return { counts, blocking };
}

function toRow(violation: { id: string; impact?: string | null; nodes: unknown[] }): object {
  return { id: violation.id, impact: violation.impact, nodes: violation.nodes.length };
}
