import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RodData } from '@power-budget/shared-app';
import { Rod } from '../Rod.js';
import { allowMotion, renderLight, restoreMedia } from './lightTestUtils.js';

const UNDER: RodData = {
  fraction: 0.404,
  paceProgress: 0.71,
  state: 'under',
  ariaLabel: 'Groceries: 1 051,36 zł left of 2 200,00 zł',
  size: 'pace',
};

afterEach(restoreMedia);

describe('Rod', () => {
  it('is an image with the aria-label', () => {
    const { getByRole } = renderLight(<Rod rod={UNDER} />);

    expect(getByRole('img', { name: UNDER.ariaLabel })).toBeInTheDocument();
  });

  it('draws the beam by the fraction and the pace mark at month-left', () => {
    const { getByTestId, queryByTestId } = renderLight(<Rod rod={UNDER} />);

    expect(getByTestId('rod-beam').style.width).toBe('40.4%');
    expect(getByTestId('rod-pace').style.left).toBe('29%');
    expect(queryByTestId('rod-tag')).toBeNull();
  });

  it('is 16 high as a pace rod and 10 high as a category rod', () => {
    const pace = renderLight(<Rod rod={UNDER} />);
    const paceHeight = pace.getByTestId('rod-track').style.height;
    pace.unmount();
    const category = renderLight(<Rod rod={{ ...UNDER, size: 'category' }} />);

    expect(paceHeight).toBe('16px');
    expect(category.getByTestId('rod-track').style.height).toBe('10px');
  });

  it('shows hatch and tag, no light, when over', () => {
    const { getByTestId, queryByTestId } = renderLight(
      <Rod rod={{ ...UNDER, state: 'over', fraction: 0 }} tagLabel="Over by 62,50 zł" />,
    );

    expect(getByTestId('rod-hatch')).toBeInTheDocument();
    expect(getByTestId('rod-tag').textContent).toBe('Over by 62,50 zł');
    expect(queryByTestId('rod-beam')).toBeNull();
  });

  it('shows the translated default tag when over has no label', () => {
    const { getByTestId } = renderLight(<Rod rod={{ ...UNDER, state: 'over', fraction: 0 }} />);

    expect(getByTestId('rod-tag').textContent).toBe('Over budget');
  });

  it('shows the Paid tag and no light when paid', () => {
    const { getByTestId, queryByTestId } = renderLight(
      <Rod rod={{ ...UNDER, state: 'paid', fraction: 0.5 }} />,
    );

    expect(getByTestId('rod-tag').textContent).toBe('Paid');
    expect(queryByTestId('rod-beam')).toBeNull();
    expect(queryByTestId('rod-hatch')).toBeNull();
  });

  it('shows no light and no tag when empty', () => {
    const { queryByTestId } = renderLight(<Rod rod={{ ...UNDER, state: 'empty', fraction: 0 }} />);

    expect(queryByTestId('rod-beam')).toBeNull();
    expect(queryByTestId('rod-tag')).toBeNull();
  });

  it('renders no beam and no spark at f = 0', () => {
    allowMotion();
    const { queryByTestId } = renderLight(<Rod rod={{ ...UNDER, fraction: 0 }} />);

    expect(queryByTestId('rod-beam')).toBeNull();
    expect(queryByTestId('rod-spark')).toBeNull();
  });

  it('attaches d7-flicker and d7-travel with motion allowed', () => {
    allowMotion();
    const { getByTestId } = renderLight(<Rod rod={UNDER} />);

    expect(getComputedStyle(getByTestId('rod-beam')).animation).toContain('d7-flicker');
    expect(getComputedStyle(getByTestId('rod-beam')).animation).toContain('d7-reveal');
    expect(getComputedStyle(getByTestId('rod-spark')).animation).toContain('d7-travel');
  });

  it('shows the static full-length frame with reduced motion', () => {
    const { getByTestId, queryByTestId } = renderLight(<Rod rod={UNDER} />);

    expect(getByTestId('rod-beam').style.animation).toBe('');
    expect(getByTestId('rod-beam').style.width).toBe('40.4%');
    expect(queryByTestId('rod-spark')).toBeNull();
  });

  it('desynchronises loops between rows', () => {
    allowMotion();
    const first = renderLight(<Rod rod={UNDER} index={0} />);
    const a = first.getByTestId('rod-beam').style.animation;
    first.unmount();
    const second = renderLight(<Rod rod={UNDER} index={1} />);

    expect(second.getByTestId('rod-beam').style.animation).not.toBe(a);
  });
});
