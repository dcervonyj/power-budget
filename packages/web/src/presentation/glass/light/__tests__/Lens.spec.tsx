import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Lens } from '../Lens.js';
import { allowMotion, renderLight, restoreMedia } from './lightTestUtils.js';
import type { LensData } from '@power-budget/shared-app';

const UNDER: LensData = {
  fraction: 4770 / 11800,
  amountLabel: '477',
  caption: '10 days left',
  ariaLabel: '477 zł a day, 10 days left',
  size: 'hero',
};

afterEach(restoreMedia);

describe('Lens', () => {
  it('is an image with the aria-label and keeps the caption outside the glass', () => {
    const { getByRole, getByText } = renderLight(<Lens lens={UNDER} unitLabel="zł a day" />);
    const image = getByRole('img', { name: '477 zł a day, 10 days left' });

    expect(image).toBeInTheDocument();
    expect(image).toContainElement(getByText('477'));
    expect(image).not.toContainElement(getByText('10 days left'));
  });

  it('puts the number in the upper 42 percent only', () => {
    const { getByTestId } = renderLight(<Lens lens={UNDER} />);
    const style = getByTestId('lens-text').style;

    expect(parseFloat(style.top) + parseFloat(style.height)).toBeLessThanOrEqual(42);
  });

  it('sizes the frame 264, 220 and 120', () => {
    const sizes = (['hero', 'mobile', 'mini'] as const).map((size) => {
      const { getByTestId, unmount } = renderLight(<Lens lens={{ ...UNDER, size }} />);
      const width = getByTestId('lens-frame').style.width;
      unmount();

      return width;
    });

    expect(sizes).toEqual(['264px', '220px', '120px']);
  });

  it('draws the core at 62 percent size, 0.77 opacity and 0.70 bloom for f = 0.404', () => {
    const { getByTestId } = renderLight(<Lens lens={UNDER} />);
    const core = getByTestId('lens-core');

    expect(core.style.width).toBe('62%');
    expect(core.style.opacity).toBe('0.77');
    expect(getByTestId('lens-bloom').style.opacity).toBe('0.7');
  });

  it('hides core, caustics and sparks when f = 0', () => {
    const { queryByTestId, queryAllByTestId } = renderLight(
      <Lens lens={{ ...UNDER, fraction: 0 }} />,
    );

    expect(queryByTestId('lens-core')).toBeNull();
    expect(queryByTestId('lens-caustics')).toBeNull();
    expect(queryAllByTestId('lens-spark')).toHaveLength(0);
  });

  it('keeps a computed opacity and an opacity loop on different elements', () => {
    allowMotion();
    const { getByTestId } = renderLight(<Lens lens={UNDER} />);

    expect(getByTestId('lens-core').style.animation).toBe('');
    expect(getByTestId('lens-core').style.transform).toBe('translate(-50%, -50%)');
    expect(getByTestId('lens-core-glow').style.animation).toContain('d7-flicker');
    expect(getByTestId('lens-bloom').style.animation).toBe('');
  });

  it('attaches the loops with motion allowed', () => {
    allowMotion();
    const { getByTestId, getAllByTestId } = renderLight(<Lens lens={UNDER} />);

    expect(getComputedStyle(getByTestId('lens-core-glow')).animation).toContain('d7-flicker');
    expect(getComputedStyle(getByTestId('lens-core-glow')).animation).toContain('d7-glowin');
    expect(getComputedStyle(getByTestId('lens-caustics')).animation).toContain('d7-caustic');
    expect(getComputedStyle(getAllByTestId('lens-spark')[0] as HTMLElement).animation).toContain(
      'd7-twinkle',
    );
  });

  it('shows a static frame with reduced motion', () => {
    const { getByTestId, getAllByTestId } = renderLight(<Lens lens={UNDER} />);

    expect(getByTestId('lens-core-glow').style.animation).toBe('');
    expect(getByTestId('lens-caustics').style.animation).toBe('');
    expect(getAllByTestId('lens-spark')[0]?.style.animation).toBe('');
    expect(getByTestId('lens-core').style.width).toBe('62%');
  });
});
