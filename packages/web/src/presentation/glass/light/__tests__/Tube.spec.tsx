import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tube } from '../Tube.js';
import { allowMotion, renderLight, restoreMedia } from './lightTestUtils.js';

const DATA = { fraction: 0.7, ariaLabel: 'Lisbon in May: 6 340,00 zł of 9 000,00 zł' };

afterEach(restoreMedia);

describe('Tube', () => {
  it('is an image with the aria-label', () => {
    const { getByRole } = renderLight(<Tube tube={DATA} />);

    expect(getByRole('img', { name: DATA.ariaLabel })).toBeInTheDocument();
  });

  it('rises from the bottom by the fraction', () => {
    const { getByTestId } = renderLight(<Tube tube={DATA} />);

    expect(getByTestId('tube-beam').style.height).toBe('70%');
    expect(getByTestId('tube-beam').style.bottom).toBe('0px');
  });

  it('has no light and no spark when empty', () => {
    allowMotion();
    const { queryByTestId } = renderLight(<Tube tube={{ ...DATA, fraction: 0 }} />);

    expect(queryByTestId('tube-beam')).toBeNull();
    expect(queryByTestId('tube-spark')).toBeNull();
  });

  it('attaches d7-reveal-v, d7-flicker and d7-rise-v with motion allowed', () => {
    allowMotion();
    const { getByTestId } = renderLight(<Tube tube={DATA} />);

    expect(getComputedStyle(getByTestId('tube-beam')).animation).toContain('d7-reveal-v');
    expect(getComputedStyle(getByTestId('tube-beam')).animation).toContain('d7-flicker');
    expect(getComputedStyle(getByTestId('tube-spark')).animation).toContain('d7-rise-v');
  });

  it('shows the static frame with reduced motion', () => {
    const { getByTestId, queryByTestId } = renderLight(<Tube tube={DATA} />);

    expect(getByTestId('tube-beam').style.animation).toBe('');
    expect(queryByTestId('tube-spark')).toBeNull();
  });
});
