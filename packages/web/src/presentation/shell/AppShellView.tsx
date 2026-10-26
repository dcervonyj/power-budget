import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { SyncChip, type SyncChipViewer } from '../glass/atoms/SyncChip.js';
import type { SyncChipState } from '../glass/atoms/syncChipState.js';
import { CountBadge } from '../glass/controls/CountBadge.js';
import { AmbientField } from '../glass/material/AmbientField.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { SHEET_BREAKPOINT_QUERY } from '../glass/overlays/Sheet.js';
import { useMediaQuery } from '../theme/mediaQuery.js';
import { AccountMenu, type AccountMenuProps } from './AccountMenu.js';
import { Brand } from './Brand.js';
import { HEADER_LINKS, TO_SORT_PATH, headerItemOf, type ShellNavItem } from './shellNav.js';
import { TAB_BAR_HEIGHT, TabBar } from './TabBar.js';
import { WORD_GAP } from './wordGap.js';
import './shell.css';

/** Compact layout (compact header + bottom tab bar) at this width and below; same as Sheet. */
export const SHELL_COMPACT_QUERY = SHEET_BREAKPOINT_QUERY;

export const SHELL_MAX_WIDTH = 1280;

export interface ShellSyncChip {
  readonly key: string;
  readonly state: SyncChipState;
  readonly viewer: SyncChipViewer;
  readonly onPress?: () => void;
}

export interface AppShellViewProps {
  readonly active: ShellNavItem | null;
  /** Transactions to sort; null while unknown (no badge). */
  readonly toSortCount: number | null;
  readonly syncChips: readonly ShellSyncChip[];
  readonly account: AccountMenuProps;
  readonly children: React.ReactNode;
}

/**
 * The D7 app shell (props only): ambient light field, tinted header with the main nav, the
 * to-sort badge, sync chips and the account menu; at 820 px and below a compact header and a
 * bottom tab bar instead of the header nav.
 */
export function AppShellView({
  active,
  toSortCount,
  syncChips,
  account,
  children,
}: AppShellViewProps): React.JSX.Element {
  const compact = useMediaQuery(SHELL_COMPACT_QUERY);
  const bottomRoom = compact
    ? `calc(${String(TAB_BAR_HEIGHT + 32)}px + env(safe-area-inset-bottom, 0px))`
    : '48px';

  return (
    <div
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100vh',
        color: 'var(--pb-glass-fg)',
        fontFamily: "'Geist Variable', system-ui, sans-serif",
      }}
    >
      <AmbientField />
      <a href="#main-content" className="pbs-skip">
        <FormattedMessage id="shell.skipToContent" defaultMessage="Skip to content" />
      </a>
      <ShellHeader
        compact={compact}
        active={active}
        toSortCount={toSortCount}
        syncChips={syncChips}
        account={account}
      />
      <main
        id="main-content"
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 1,
          minWidth: 0,
          paddingTop: 'var(--pb-glass-space-lg)',
          paddingBottom: bottomRoom,
          outline: 'none',
        }}
      >
        {children}
      </main>
      {compact ? <TabBar active={active} toSortCount={toSortCount} /> : null}
    </div>
  );
}

interface ShellHeaderProps {
  readonly compact: boolean;
  readonly active: ShellNavItem | null;
  readonly toSortCount: number | null;
  readonly syncChips: readonly ShellSyncChip[];
  readonly account: AccountMenuProps;
}

function ShellHeader({
  compact,
  active,
  toSortCount,
  syncChips,
  account,
}: ShellHeaderProps): React.JSX.Element {
  const intl = useIntl();
  const headerToSort = compact || toSortCount === null ? 0 : toSortCount;

  return (
    <header
      style={{
        position: 'relative',
        zIndex: 30,
        padding: compact ? '8px 8px 0' : '16px 24px 0',
      }}
    >
      {/* The tinted glass is a layer behind the bar, not its parent: the account menu then
          blurs the page under it instead of only the header. */}
      <div style={{ position: 'relative', maxWidth: SHELL_MAX_WIDTH, margin: '0 auto' }}>
        <GlassPanel
          material="tinted"
          depth={1}
          decor={{ specular: true, film: true }}
          radius="var(--pb-glass-radius-tile)"
          style={{ position: 'absolute', inset: 0 }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: compact ? 'var(--pb-glass-space-sm)' : 'var(--pb-glass-space-md)',
            rowGap: 'var(--pb-glass-space-xs)',
            padding: compact ? '6px 6px 6px 14px' : '8px 10px 8px 20px',
          }}
        >
          <Brand />
          {compact ? null : (
            <nav
              aria-label={intl.formatMessage({ id: 'shell.nav.label', defaultMessage: 'Main' })}
              style={{ marginLeft: 'var(--pb-glass-space-md)' }}
            >
              <ul
                style={{ display: 'flex', gap: 'var(--pb-glass-space-xxs)', margin: 0, padding: 0 }}
              >
                {HEADER_LINKS.map((link) => (
                  <li key={link.item} style={{ listStyle: 'none' }}>
                    <Link
                      to={link.to}
                      aria-current={link.item === headerItemOf(active) ? 'page' : undefined}
                      className="pbs-link"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 44,
                        padding: '0 16px',
                        borderRadius: 22,
                        fontSize: 'var(--pb-glass-type-label-web)',
                        fontWeight: 'var(--pb-glass-type-label-weight)',
                      }}
                    >
                      <FormattedMessage {...link.label} />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <span aria-hidden="true" style={{ flex: '1 1 0', minWidth: 0 }} />
          {headerToSort > 0 ? (
            <ToSortLink count={headerToSort} current={active === 'toSort'} />
          ) : null}
          {compact ? null : <SyncChips chips={syncChips} />}
          <AccountMenu {...account} />
          {compact && syncChips.length > 0 ? (
            <div style={{ flexBasis: '100%', minWidth: 0, paddingBottom: 2 }}>
              <SyncChips chips={syncChips} />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** "3 to sort": the name is the visible badge and words (no aria-label to drift from them). */
function ToSortLink({ count, current }: { count: number; current: boolean }): React.JSX.Element {
  return (
    <Link
      to={TO_SORT_PATH}
      aria-current={current ? 'page' : undefined}
      className="pbs-link"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--pb-glass-space-xs)',
        minHeight: 44,
        padding: '0 14px 0 10px',
        borderRadius: 22,
        fontSize: 'var(--pb-glass-type-small-web)',
        fontWeight: 'var(--pb-glass-type-label-weight)',
      }}
    >
      <CountBadge count={count} />
      {WORD_GAP}
      <FormattedMessage id="shell.toSort.label" defaultMessage="to sort" />
    </Link>
  );
}

function SyncChips({ chips }: { chips: readonly ShellSyncChip[] }): React.JSX.Element | null {
  const intl = useIntl();
  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={intl.formatMessage({ id: 'shell.sync.label', defaultMessage: 'Bank sync' })}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pb-glass-space-xs)', minWidth: 0 }}
    >
      {chips.map((chip) => (
        <SyncChip key={chip.key} state={chip.state} viewer={chip.viewer} onPress={chip.onPress} />
      ))}
    </div>
  );
}
