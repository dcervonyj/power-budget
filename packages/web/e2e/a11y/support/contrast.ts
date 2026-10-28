import type { Page } from '@playwright/test';

/** WCAG 2.x AA thresholds: normal text, and large text (>= 24 px, or >= 18.66 px bold). */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

export interface TextMeasurement {
  readonly text: string;
  readonly tag: string;
  readonly color: string;
  readonly fontSize: number;
  readonly large: boolean;
  readonly required: number;
  /** Lowest contrast over every sampled background pixel behind the text (unrounded). */
  readonly worst: number;
  /** Background colour of that worst pixel. */
  readonly worstBackground: string;
}

interface TextProbe {
  readonly text: string;
  readonly tag: string;
  readonly color: readonly [number, number, number, number];
  readonly fontSize: number;
  readonly large: boolean;
  readonly rects: readonly { x: number; y: number; width: number; height: number }[];
}

/**
 * Measures the contrast of the text rendered on the page (or inside `rootSelector`). The page is
 * screenshotted as rendered and again with all text hidden; the pixels that differ are the glyph
 * pixels, and the text colour is composited against the hidden-text background at each of them.
 * The ratio is the WCAG relative-luminance one, taken at the worst glyph pixel. Inactive
 * (disabled) controls, closed `details` content and visually hidden text are not measured.
 */
export async function measureRenderedText(
  page: Page,
  rootSelector = 'body',
): Promise<TextMeasurement[]> {
  const probes = await page.evaluate(collectTextProbes, rootSelector);
  const shown = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await page.addStyleTag({
    content:
      '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } ::placeholder { color: transparent !important; }',
  });
  const hidden = await page.screenshot({ fullPage: true, animations: 'disabled' });

  return page.evaluate(measureAgainstScreenshot, {
    shown: shown.toString('base64'),
    hidden: hidden.toString('base64'),
    probes,
  });
}

/** Browser side: one probe per visible element that owns text. Self-contained (serialised). */
function collectTextProbes(rootSelector: string): TextProbe[] {
  const roots = Array.from(document.querySelectorAll(rootSelector));
  if (roots.length === 0) {
    throw new Error(`contrast: nothing matches ${rootSelector}`);
  }
  const result: TextProbe[] = [];
  const elements = roots.flatMap((root) => [root, ...Array.from(root.querySelectorAll('*'))]);
  // Text a field draws itself: the value, or the placeholder while it is empty; the chosen
  // option of a select; the date a date input shows (its mask while empty).
  const textTypes = ['text', 'email', 'search', 'tel', 'url', 'number', 'password'];
  const dateTypes = ['date', 'time', 'month', 'week', 'datetime-local'];
  function fieldText(element: Element): { text: string; placeholder: boolean } {
    const none = { text: '', placeholder: false };
    if (element instanceof HTMLSelectElement) {
      return { text: element.selectedOptions[0]?.text.trim() ?? '', placeholder: false };
    }
    if (element instanceof HTMLInputElement && dateTypes.includes(element.type)) {
      return { text: element.value === '' ? element.type : element.value, placeholder: false };
    }
    if (
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLInputElement && textTypes.includes(element.type))
    ) {
      return none;
    }
    if (element.value !== '') {
      return element instanceof HTMLInputElement && element.type === 'password'
        ? none
        : { text: element.value, placeholder: false };
    }

    return { text: element.placeholder, placeholder: element.placeholder !== '' };
  }
  for (const element of elements) {
    const own = Array.from(element.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
    );
    const field = fieldText(element);
    const drawn = field.text;
    if (own.length === 0 && drawn === '') {
      continue;
    }
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') {
      continue;
    }
    const box = element.getBoundingClientRect();
    if (box.width <= 2 || box.height <= 2) {
      continue;
    }
    if (element.closest('[disabled], [aria-disabled="true"], fieldset:disabled') !== null) {
      continue;
    }
    const closedDetails = element.closest('details:not([open])');
    if (closedDetails !== null && element.closest('summary') === null) {
      continue;
    }
    let opacity = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    if (opacity === 0) {
      continue;
    }
    const colorText = field.placeholder
      ? getComputedStyle(element, '::placeholder').color
      : style.color;
    const match = /rgba?\(([^)]+)\)/.exec(colorText);
    const parts = (match?.[1] ?? '0,0,0').split(/[ ,/]+/).filter((part) => part !== '');
    const alpha = (parts[3] === undefined ? 1 : Number(parts[3])) * opacity;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const node of own) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        const onPage =
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < document.documentElement.scrollWidth &&
          rect.top < document.documentElement.scrollHeight;
        if (rect.width > 2 && rect.height > 2 && onPage) {
          rects.push({
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
          });
        }
      }
    }
    if (drawn !== '') {
      const padLeft = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      const padRight = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
      const padTop = parseFloat(style.paddingTop) + parseFloat(style.borderTopWidth);
      const padBottom = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
      rects.push({
        x: box.left + window.scrollX + padLeft,
        y: box.top + window.scrollY + padTop,
        width: box.width - padLeft - padRight,
        height: box.height - padTop - padBottom,
      });
    }
    if (rects.length === 0) {
      continue;
    }
    const fontSize = parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    result.push({
      text: (drawn !== ''
        ? drawn
        : own.map((node) => (node.textContent ?? '').trim()).join(' ')
      ).slice(0, 48),
      tag: element.tagName.toLowerCase(),
      color: [Number(parts[0]), Number(parts[1]), Number(parts[2]), alpha],
      fontSize,
      large: fontSize >= 24 || (bold && fontSize >= 18.66),
      rects,
    });
  }

  return result;
}

/** Browser side: decodes the screenshot and scores every probe. Self-contained (serialised). */
async function measureAgainstScreenshot(input: {
  shown: string;
  hidden: string;
  probes: TextProbe[];
}): Promise<TextMeasurement[]> {
  async function decode(base64: string): Promise<CanvasRenderingContext2D | null> {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context?.drawImage(bitmap, 0, 0);

    return context;
  }
  const shownContext = await decode(input.shown);
  const context = await decode(input.hidden);
  if (shownContext === null || context === null) {
    throw new Error('contrast: a screenshot could not be decoded');
  }
  const hiddenPixels: CanvasRenderingContext2D = context;
  const shownPixels: CanvasRenderingContext2D = shownContext;
  const bitmapWidth = context.canvas.width;
  const bitmapHeight = context.canvas.height;

  function channel(value: number): number {
    const unit = value / 255;

    return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
  }
  function luminance(r: number, g: number, b: number): number {
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  function ratio(a: number, b: number): number {
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  return input.probes.map((probe) => {
    const [tr, tg, tb, ta] = probe.color;
    let worst = Infinity;
    let worstBackground = '';
    function measure(onlyGlyphs: boolean): number {
      let counted = 0;
      for (const rect of probe.rects) {
        const x = Math.max(0, Math.floor(rect.x));
        const y = Math.max(0, Math.floor(rect.y));
        const width = Math.max(1, Math.min(bitmapWidth - x, Math.ceil(rect.width)));
        const height = Math.max(1, Math.min(bitmapHeight - y, Math.ceil(rect.height)));
        const data = hiddenPixels.getImageData(x, y, width, height).data;
        const withText = shownPixels.getImageData(x, y, width, height).data;
        for (let index = 0; index < data.length; index += 4) {
          const br = data[index] ?? 0;
          const bg = data[index + 1] ?? 0;
          const bb = data[index + 2] ?? 0;
          // The colour a fully covered pixel shows: the text colour over this background.
          const r = tr * ta + br * (1 - ta);
          const g = tg * ta + bg * (1 - ta);
          const b = tb * ta + bb * (1 - ta);
          if (onlyGlyphs) {
            // A glyph pixel of this text lies on the line from the background to that colour,
            // and (near) the end of it. Pixels of other text drawn in the box fall off it.
            const dr = r - br;
            const dg = g - bg;
            const db = b - bb;
            const sr = (withText[index] ?? 0) - br;
            const sg = (withText[index + 1] ?? 0) - bg;
            const sb = (withText[index + 2] ?? 0) - bb;
            const span = dr * dr + dg * dg + db * db;
            if (span < 100) {
              continue;
            }
            const along = (sr * dr + sg * dg + sb * db) / span;
            const off = Math.hypot(sr - along * dr, sg - along * dg, sb - along * db);
            if (along < 0.85 || along > 1.15 || off > 16) {
              continue;
            }
          }
          counted += 1;
          const value = ratio(luminance(r, g, b), luminance(br, bg, bb));
          if (value < worst) {
            worst = value;
            worstBackground = `rgb(${String(br)},${String(bg)},${String(bb)})`;
          }
        }
      }

      return counted;
    }
    // Glyph pixels first; when none can be told apart (text almost the colour of its background)
    // every pixel of the text box counts.
    if (measure(true) === 0) {
      measure(false);
    }

    return {
      text: probe.text,
      tag: probe.tag,
      color: `rgba(${String(tr)},${String(tg)},${String(tb)},${ta.toFixed(2)})`,
      fontSize: probe.fontSize,
      large: probe.large,
      required: probe.large ? 3 : 4.5,
      worst: worst === Infinity ? 21 : worst,
      worstBackground,
    };
  });
}
