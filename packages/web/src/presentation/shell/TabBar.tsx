import React from 'react';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Icon } from '../glass/atoms/Icon.js';
import { CountBadge } from '../glass/controls/CountBadge.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { TAB_LINKS, type ShellNavItem, type ShellNavLink } from './shellNav.js';
import { WORD_GAP } from './wordGap.js';
import './shell.css';

export interface TabBarProps {
  readonly active: ShellNavItem | null;
  readonly toSortCount: number | null;
}

/** Height of the bar without the safe-area inset; the page keeps this much room at the bottom. */
export const TAB_BAR_HEIGHT = 64;

/** Bottom tab bar at 820 px and below, mirroring the mobile tabs. Tinted glass, fixed. */
export function TabBar({ active, toSortCount }: TabBarProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <nav
      aria-label={intl.formatMessage({ id: 'shell.nav.label', defaultMessage: 'Main' })}
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        zIndex: 40,
      }}
    >
      <GlassPanel
        material="tinted"
        depth={1}
        decor={{ specular: true, film: true }}
        radius="var(--pb-glass-radius-panel)"
      >
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(TAB_LINKS.length)}, minmax(0, 1fr))`,
            height: TAB_BAR_HEIGHT,
            margin: 0,
            padding: '0 4px',
          }}
        >
          {TAB_LINKS.map((link) => (
            <li key={link.item} style={{ listStyle: 'none', display: 'flex', minWidth: 0 }}>
              <Tab link={link} current={link.item === active} toSortCount={toSortCount} />
            </li>
          ))}
        </ul>
      </GlassPanel>
    </nav>
  );
}

function Tab({
  link,
  current,
  toSortCount,
}: {
  link: ShellNavLink;
  current: boolean;
  toSortCount: number | null;
}): React.JSX.Element {
  const intl = useIntl();
  const count = link.item === 'toSort' && toSortCount !== null ? toSortCount : 0;
  const label = intl.formatMessage(link.label);

  return (
    <Link
      to={link.to}
      aria-current={current ? 'page' : undefined}
      className="pbs-link"
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        margin: '6px 2px',
        borderRadius: 'var(--pb-glass-radius-control)',
        fontSize: 'var(--pb-glass-type-tag-web)',
        fontWeight: current ? 600 : 500,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Icon name={link.icon} size={22} />
        {count > 0 ? (
          <span style={{ position: 'absolute', top: -8, left: 14 }}>
            <CountBadge count={count} />
          </span>
        ) : null}
      </span>
      {WORD_GAP}
      <span
        style={{
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </Link>
  );
}
