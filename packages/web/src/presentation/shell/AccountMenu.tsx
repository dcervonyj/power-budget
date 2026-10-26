import React, { useEffect, useId, useRef, useState } from 'react';
import { FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { Link } from 'react-router-dom';
import type { SupportedLocale } from '@power-budget/core';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';
import type { ShellPerson } from '../../application/shell/ShellStore.js';
import { AvatarPair } from '../glass/atoms/Avatar.js';
import { Icon } from '../glass/atoms/Icon.js';
import type { IconName } from '../glass/atoms/iconPaths.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { useDialogBehavior } from '../glass/overlays/useDialogBehavior.js';
import type { ThemePreference } from '../theme/themePreference.js';
import { LocaleSelect } from './LocaleSelect.js';
import { ThemeChoice } from './ThemeChoice.js';
import './shell.css';

export interface AccountMenuProps {
  readonly me: ShellPerson | null;
  readonly partner: ShellPerson | null;
  readonly themePreference: ThemePreference;
  readonly onThemeChange: (preference: ThemePreference) => void;
  readonly locale: SupportedLocale;
  readonly onLocaleChange: (locale: SupportedLocale) => void;
  readonly onSignOut: () => void;
  readonly signingOut: boolean;
  /** Starts open (gallery fixtures). */
  readonly defaultOpen?: boolean;
}

interface AccountLink {
  readonly to: string;
  readonly icon: IconName;
  readonly label: MessageDescriptor;
}

/** Everything that is not a main destination lives here (Q7). */
const ACCOUNT_LINKS: readonly AccountLink[] = [
  {
    to: ROUTE_PATHS.categories,
    icon: 'categories',
    label: { id: 'shell.account.categories', defaultMessage: 'Categories' },
  },
  {
    to: ROUTE_PATHS.household,
    icon: 'users',
    label: { id: 'shell.account.household', defaultMessage: 'Household' },
  },
  {
    to: ROUTE_PATHS.bankConnections,
    icon: 'bank',
    label: { id: 'shell.account.banks', defaultMessage: 'Banks' },
  },
  {
    to: ROUTE_PATHS.settings,
    icon: 'settings',
    label: { id: 'shell.account.settings', defaultMessage: 'Settings' },
  },
  {
    to: ROUTE_PATHS.audit,
    icon: 'clock',
    label: { id: 'shell.account.audit', defaultMessage: 'Audit log' },
  },
];

const AVATAR_SIZE = 32;

/**
 * The avatar pair in the header opens the account menu: account pages, appearance, language and
 * sign out. Keyboard: Enter / Space opens it and moves focus in, Tab stays inside, Esc closes it
 * and returns focus to the button; a click outside or on a link closes it too.
 */
export function AccountMenu(props: AccountMenuProps): React.JSX.Element {
  const { me, partner, defaultOpen = false } = props;
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) !== true) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function toggle(): void {
    setOpen(!open);
  }

  function close(): void {
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        className="pbs-focus"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--pb-glass-space-xs)',
          minHeight: 44,
          padding: '0 10px 0 6px',
          border: 'none',
          borderRadius: 22,
          background: 'var(--pb-glass-clear)',
          boxShadow: 'var(--pb-glass-clear-rim)',
          color: 'var(--pb-glass-dim)',
          cursor: 'pointer',
        }}
      >
        <PeopleMark me={me} partner={partner} />
        <span className="pbs-sr-only">
          <FormattedMessage id="shell.account.open" defaultMessage="Account and settings" />
        </span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open ? <AccountPanel {...props} id={panelId} onClose={close} /> : null}
    </div>
  );
}

function PeopleMark({
  me,
  partner,
}: {
  me: ShellPerson | null;
  partner: ShellPerson | null;
}): React.JSX.Element {
  if (me === null) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: '50%',
          background: 'var(--pb-glass-fill2)',
          color: 'var(--pb-glass-fg)',
        }}
      >
        <Icon name="users" size={18} />
      </span>
    );
  }

  return (
    <AvatarPair
      primary={me}
      secondary={partner === null ? undefined : partner}
      size={AVATAR_SIZE}
    />
  );
}

interface AccountPanelProps extends AccountMenuProps {
  readonly id: string;
  readonly onClose: () => void;
}

function AccountPanel({
  id,
  onClose,
  me,
  partner,
  themePreference,
  onThemeChange,
  locale,
  onLocaleChange,
  onSignOut,
  signingOut,
}: AccountPanelProps): React.JSX.Element {
  const intl = useIntl();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(panelRef, { active: true, onClose });

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={intl.formatMessage({ id: 'shell.account.title', defaultMessage: 'Account' })}
      tabIndex={-1}
      className="pbs-menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: 60,
        width: 320,
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <GlassPanel
        material="frosted"
        depth={0}
        decor={{ specular: true, film: true }}
        radius="var(--pb-glass-radius-tile)"
        contentStyle={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--pb-glass-space-md)',
          padding: 'var(--pb-glass-space-md)',
        }}
      >
        {me === null ? null : <Identity me={me} partner={partner} />}
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: 0, padding: 0 }}>
          {ACCOUNT_LINKS.map((link) => (
            <li key={link.to} style={{ listStyle: 'none' }}>
              <Link
                to={link.to}
                onClick={onClose}
                className="pbs-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--pb-glass-space-sm)',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 'var(--pb-glass-radius-control)',
                  fontSize: 'var(--pb-glass-type-body-web)',
                }}
              >
                <Icon name={link.icon} size={18} />
                <FormattedMessage {...link.label} />
              </Link>
            </li>
          ))}
        </ul>
        <hr
          aria-hidden="true"
          style={{
            width: '100%',
            margin: 0,
            border: 0,
            borderTop: '1px solid var(--pb-glass-sep)',
          }}
        />
        <ThemeChoice value={themePreference} onChange={onThemeChange} />
        <LocaleSelect id={`${id}-locale`} locale={locale} onChange={onLocaleChange} />
        <button
          type="button"
          className="pbs-focus"
          disabled={signingOut}
          onClick={onSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--pb-glass-space-sm)',
            minHeight: 44,
            border: 'none',
            borderRadius: 'var(--pb-glass-radius-control)',
            background: 'var(--pb-glass-clear)',
            boxShadow: 'var(--pb-glass-clear-rim)',
            color: 'var(--pb-glass-fg)',
            fontSize: 'var(--pb-glass-type-body-web)',
            fontWeight: 'var(--pb-glass-type-label-weight)',
            cursor: signingOut ? 'progress' : 'pointer',
          }}
        >
          <Icon name="arrow-right" size={18} />
          {signingOut ? (
            <FormattedMessage id="shell.account.signingOut" defaultMessage="Signing out…" />
          ) : (
            <FormattedMessage id="shell.account.signOut" defaultMessage="Sign out" />
          )}
        </button>
      </GlassPanel>
    </div>
  );
}

function Identity({
  me,
  partner,
}: {
  me: ShellPerson;
  partner: ShellPerson | null;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-sm)' }}>
      <AvatarPair primary={me} secondary={partner === null ? undefined : partner} size={40} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            color: 'var(--pb-glass-fg)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {me.name}
        </span>
        {partner === null ? null : (
          <span
            style={{
              color: 'var(--pb-glass-dim)',
              fontSize: 'var(--pb-glass-type-small-web)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {partner.name}
          </span>
        )}
      </div>
    </div>
  );
}
