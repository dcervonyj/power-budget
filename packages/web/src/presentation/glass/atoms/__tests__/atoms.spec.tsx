import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { Avatar, AvatarPair, initialsOf } from '../Avatar.js';
import { Icon } from '../Icon.js';
import { ICON_NAMES, ICON_PATHS } from '../iconPaths.js';
import { StatusTag } from '../StatusTag.js';

describe('Icon', () => {
  it('has a non-empty path for every name and hides itself from assistive tech', () => {
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(0);
    }
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);

    const { container } = render(<Icon name="check" size={18} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('width')).toBe('18');
  });
});

describe('StatusTag', () => {
  it.each(['ok', 'over', 'neutral'] as const)('shows icon and words for %s', (kind) => {
    const { container } = render(<StatusTag kind={kind} label="Words" />);

    expect(container.textContent).toBe('Words');
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('Avatar', () => {
  it('builds initials from the first two words', () => {
    expect(initialsOf('Anna Maria Kowalska')).toBe('AM');
    expect(initialsOf('  олена ')).toBe('О');
    expect(initialsOf('')).toBe('');
  });

  it('is named by the person and pairs two people', () => {
    render(
      <IntlProvider locale="en" messages={{}}>
        <AvatarPair primary={{ name: 'Anna Kowalska' }} secondary={{ name: 'Marek Nowak' }} />
      </IntlProvider>,
    );

    expect(screen.getByRole('img', { name: 'Anna Kowalska' }).textContent).toBe('AK');
    expect(screen.getByRole('img', { name: 'Marek Nowak' }).textContent).toBe('MN');
  });

  it('renders a photo when an image url is given', () => {
    const { container } = render(
      <Avatar person={{ name: 'Anna', imageUrl: 'https://example.test/a.png' }} />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.test/a.png');
  });
});
