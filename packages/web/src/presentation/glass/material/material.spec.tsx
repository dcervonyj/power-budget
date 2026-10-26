import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientField } from './AmbientField.js';
import { DepthPanes } from './DepthPanes.js';
import { GlassPanel } from './GlassPanel.js';

function allowMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error('expected a rendered root element');
  }

  return root;
}

function animationsIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[style]')]
    .map((element) => element.style.animation)
    .filter((animation) => animation !== '');
}

const CONTENT = 'content';
const REAL = 'real content';
const HERO = 'hero';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GlassPanel', () => {
  it('renders every decor span aria-hidden with pointer events off', () => {
    const { container } = render(
      <GlassPanel decor={{ specular: true, film: true, sweep: 0 }}>{CONTENT}</GlassPanel>,
    );
    const decor = container.querySelectorAll<HTMLElement>('[data-glass-decor]');

    expect([...decor].map((span) => span.dataset['glassDecor'])).toEqual([
      'specular',
      'film',
      'sweep',
    ]);
    for (const span of decor) {
      expect(span).toHaveAttribute('aria-hidden', 'true');
      expect(span.style.pointerEvents).toBe('none');
    }
  });

  it('stacks the content layer above the decor', () => {
    const { container } = render(
      <GlassPanel decor={{ specular: true, film: true }}>
        <p>{REAL}</p>
      </GlassPanel>,
    );
    const root = rootOf(container);
    const layer = screen.getByText(REAL).parentElement;
    if (layer === null) {
      throw new Error('missing content layer');
    }

    expect(layer.style.position).toBe('relative');
    expect(root.lastElementChild).toBe(layer);
    expect(layer).not.toHaveAttribute('aria-hidden');
  });

  it('picks the frosted depth background and blur', () => {
    const { container } = render(<GlassPanel material="frosted" depth={2} />);
    const root = rootOf(container);

    expect(root.style.background).toBe('var(--pb-glass-g2)');
    expect(root.style.backdropFilter).toContain('blur(');
  });

  it('keeps clear glass free of blur and tinted glass blurred', () => {
    const clear = rootOf(render(<GlassPanel material="clear" />).container);
    const tinted = rootOf(render(<GlassPanel material="tinted" />).container);

    expect(clear.style.backdropFilter).toBe('');
    expect(clear.style.background).toBe('var(--pb-glass-clear)');
    expect(tinted.style.backdropFilter).toContain('blur(');
    expect(tinted.style.background).toBe('var(--pb-glass-tint)');
  });

  it('adds the accent ring on depth 0 only', () => {
    const hero = rootOf(render(<GlassPanel depth={0} />).container);
    const base = rootOf(render(<GlassPanel depth={1} />).container);

    expect(hero.style.boxShadow).toContain('--pb-glass-accent-edge');
    expect(base.style.boxShadow).not.toContain('--pb-glass-accent-edge');
  });

  it('staggers the rise entrance by index when motion is allowed', () => {
    allowMotion();
    const { container } = render(<GlassPanel rise={3}>{CONTENT}</GlassPanel>);
    const animation = rootOf(container).style.animation;

    expect(animation).toContain('d7-rise');
    expect(animation).toContain('* 3');
  });

  it('attaches the film and sweep loops when motion is allowed', () => {
    allowMotion();
    const { container } = render(
      <GlassPanel decor={{ film: true, sweep: 2 }}>{CONTENT}</GlassPanel>,
    );
    const animations = animationsIn(container);

    expect(animations.some((value) => value.includes('d7-film'))).toBe(true);
    expect(animations.some((value) => value.includes('d7-sweep') && value.includes('8s'))).toBe(
      true,
    );
  });

  it('removes every animation style under reduced motion', () => {
    const { container } = render(
      <GlassPanel rise={2} decor={{ specular: true, film: true, sweep: 1 }}>
        {CONTENT}
      </GlassPanel>,
    );

    expect(animationsIn(container)).toEqual([]);
  });
});

describe('DepthPanes', () => {
  it('renders two aria-hidden panes behind the content', () => {
    const { container } = render(
      <DepthPanes>
        <p>{HERO}</p>
      </DepthPanes>,
    );
    const panes = container.querySelectorAll<HTMLElement>('[data-glass-decor="depth-pane"]');

    expect(panes).toHaveLength(2);
    for (const pane of panes) {
      expect(pane).toHaveAttribute('aria-hidden', 'true');
      expect(pane.style.pointerEvents).toBe('none');
    }
    expect(screen.getByText(HERO).parentElement?.style.position).toBe('relative');
  });

  it('floats the panes only when motion is allowed', () => {
    const reduced = render(<DepthPanes>{CONTENT}</DepthPanes>);
    expect(animationsIn(reduced.container)).toEqual([]);
    reduced.unmount();

    allowMotion();
    const moving = render(<DepthPanes>{CONTENT}</DepthPanes>);
    expect(animationsIn(moving.container)).toHaveLength(2);
  });
});

describe('AmbientField', () => {
  it('is aria-hidden as a whole and holds blobs, glow, beams and far slabs', () => {
    const { container } = render(<AmbientField />);
    const root = rootOf(container);

    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.style.pointerEvents).toBe('none');
    expect(root.querySelectorAll('[data-ambient="blob"]')).toHaveLength(3);
    expect(root.querySelectorAll('[data-ambient="glow"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-ambient="beam"]')).toHaveLength(2);
    expect(root.querySelectorAll('[data-ambient="far-slab"]')).toHaveLength(2);
  });

  it('can drop the honey glow', () => {
    const { container } = render(<AmbientField glow={false} />);

    expect(container.querySelectorAll('[data-ambient="glow"]')).toHaveLength(0);
  });

  it('drifts the blobs only when motion is allowed', () => {
    const reduced = render(<AmbientField />);
    expect(animationsIn(reduced.container)).toEqual([]);
    reduced.unmount();

    allowMotion();
    const moving = render(<AmbientField />);
    expect(
      animationsIn(moving.container).filter((value) => value.includes('d7-drift')),
    ).toHaveLength(3);
  });
});
