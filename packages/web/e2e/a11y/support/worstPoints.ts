import type { Page } from '@playwright/test';

/**
 * The worst backgrounds named in D7-SPEC R2.6, stacked from the real tokens (same layers the
 * app paints: page base, ambient blob, panel material) with one probe line per text token.
 */
const STAGES: Readonly<Record<string, { layers: readonly string[]; texts: readonly string[] }>> = {
  'frosted-over-bloom': {
    layers: ['--pb-glass-base', '--pb-glass-bloom-far', '--pb-glass-g1'],
    texts: ['fg', 'dim', 'faint', 'accent'],
  },
  'clear-over-sun': {
    layers: ['--pb-glass-base', '--pb-glass-b1', '--pb-glass-glow', '--pb-glass-clear'],
    texts: ['fg', 'dim', 'faint', 'accent'],
  },
  'frosted-over-sun': {
    layers: ['--pb-glass-base', '--pb-glass-b1', '--pb-glass-glow', '--pb-glass-g1'],
    texts: ['fg', 'dim', 'faint', 'accent'],
  },
  'accent-ink-on-light-solid': {
    layers: ['--pb-glass-light-solid'],
    texts: ['accent-ink'],
  },
};

/** Replaces the gallery content with the stage `name`; every probe carries `data-worst-point`. */
export async function openWorstPointStage(page: Page, name: string): Promise<void> {
  const stage = STAGES[name];
  if (stage === undefined) {
    throw new Error(`Unknown worst point ${name}`);
  }
  await page.evaluate(buildStage, { name, ...stage });
}

function buildStage(input: {
  name: string;
  layers: readonly string[];
  texts: readonly string[];
}): void {
  const main = document.querySelector('#gallery-main');
  if (main === null) {
    throw new Error('worst point stage: #gallery-main is missing');
  }
  const stage = document.createElement('div');
  stage.setAttribute('data-worst-point', input.name);
  let inner: HTMLElement = stage;
  for (const layer of input.layers) {
    const element = document.createElement('div');
    element.style.background = `var(${layer})`;
    element.style.padding = '8px';
    if (layer === '--pb-glass-g1') {
      // The frosted material filters what it covers (GlassPanel BLUR) before its fill goes on.
      element.style.backdropFilter = 'blur(var(--pb-glass-blur-web)) saturate(150%)';
    }
    inner.appendChild(element);
    inner = element;
  }
  for (const text of input.texts) {
    const line = document.createElement('p');
    line.textContent = `${text} The quick brown fox 0123456789`;
    line.style.margin = '0';
    line.style.fontSize = '15px';
    line.style.color = `var(--pb-glass-${text})`;
    inner.appendChild(line);
  }
  main.replaceChildren(stage);
}
