import type { Page } from '@playwright/test';

export interface FocusStop {
  /** Position of the stop among the DOM's expected tab stops, or -1 for one the DOM did not list. */
  readonly index: number;
  readonly label: string;
  /** Outline, or a ring / border / background change against the unfocused look. */
  readonly visibleFocus: boolean;
}

export interface TabOrderReport {
  readonly stops: readonly FocusStop[];
  /** Labels of the expected stops Tab never reached. */
  readonly unreached: readonly string[];
  /** Labels of expected stops that came after a later one (Tab order differs from DOM order). */
  readonly outOfOrder: readonly string[];
  readonly positiveTabindex: readonly string[];
}

const TABBABLE =
  'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

/**
 * Presses Tab from the top of `rootSelector` until the focus leaves it or wraps, and compares
 * the stops with what the DOM promises: visible, enabled, tabindex not -1, in DOM order. Radio
 * inputs are left out of the promise (the browser tabs a group as one stop) but their focus
 * ring is still checked.
 */
export async function walkTabOrder(page: Page, rootSelector: string): Promise<TabOrderReport> {
  const expected = await page.evaluate(prepare, { rootSelector, selector: TABBABLE });
  const stops: FocusStop[] = [];
  // A date input takes several Tab presses (one per segment) and stays the same stop.
  for (let press = 0; press < expected.labels.length * 4 + 12; press += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(describeFocus, rootSelector);
    const last = stops[stops.length - 1];
    if (stop === null || (last !== undefined && stop.index >= 0 && stop.index < last.index)) {
      break;
    }
    if (last === undefined || stop.index !== last.index || stop.label !== last.label) {
      stops.push(stop);
    }
  }
  const reached = new Set(stops.map((stop) => stop.index));
  const listed = stops.filter((stop) => stop.index >= 0).map((stop) => stop.index);
  const sorted = [...listed].sort((a, b) => a - b);

  return {
    stops,
    unreached: expected.labels.filter((_label, index) => !reached.has(index)),
    outOfOrder: listed
      .filter((value, index) => value !== sorted[index])
      .map((value) => expected.labels[value] ?? ''),
    positiveTabindex: expected.positive,
  };
}

/** Browser side. Tags the expected stops (`data-a11y-tab`) and remembers their unfocused look. */
function prepare(input: { rootSelector: string; selector: string }): {
  labels: string[];
  positive: string[];
} {
  const root = document.querySelector(input.rootSelector);
  const labels: string[] = [];
  const positive: string[] = [];
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  if (root === null) {
    return { labels, positive };
  }
  if (root instanceof HTMLElement) {
    // Start the walk at the top of the root: the next Tab goes to its first stop.
    root.tabIndex = -1;
    root.focus();
    root.removeAttribute('tabindex');
  }
  function look(element: Element): string {
    const style = getComputedStyle(element);

    return [
      style.outlineStyle,
      style.outlineWidth,
      style.boxShadow,
      style.borderColor,
      style.backgroundColor,
      style.textDecorationLine,
    ].join('|');
  }
  const looks = new Map<Element, string>();
  for (const element of Array.from(root.querySelectorAll(input.selector))) {
    looks.set(element, look(element));
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const tabindex = element.getAttribute('tabindex');
    const inactive = element.matches(':disabled') || element.closest('[inert]') !== null;
    const radio = element instanceof HTMLInputElement && element.type === 'radio';
    const closedDetails =
      element.closest('details:not([open])') !== null &&
      !(element.tagName === 'SUMMARY' && element.parentElement?.matches('details') === true);
    if (
      style.visibility === 'hidden' ||
      style.display === 'none' ||
      rect.width === 0 ||
      rect.height === 0 ||
      inactive ||
      closedDetails ||
      tabindex === '-1' ||
      radio
    ) {
      continue;
    }
    const text = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
    element.setAttribute('data-a11y-tab', String(labels.length));
    labels.push(`${element.tagName.toLowerCase()}[${text.slice(0, 32)}]`);
    if (tabindex !== null && Number(tabindex) > 0) {
      positive.push(labels[labels.length - 1] ?? '');
    }
  }
  Object.assign(window, { __a11yLooks: { looks, look } });

  return { labels, positive };
}

function describeFocus(rootSelector: string): FocusStop | null {
  const element = document.activeElement;
  const root = document.querySelector(rootSelector);
  if (element === null || root === null || element === document.body || !root.contains(element)) {
    return null;
  }
  const store: { looks: Map<Element, string>; look: (e: Element) => string } = Reflect.get(
    window,
    '__a11yLooks',
  );
  const style = getComputedStyle(element);
  const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  const changed = store.looks.get(element) !== store.look(element);
  const text = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();

  return {
    index: Number(element.getAttribute('data-a11y-tab') ?? '-1'),
    label: `${element.tagName.toLowerCase()}[${text.slice(0, 32)}]`,
    visibleFocus: outline || changed,
  };
}
