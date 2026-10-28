import { settingsStore } from '../../../composition.js';
import React from 'react';
import { runInAction } from 'mobx';
import { MemoryRouter } from 'react-router-dom';
import type { AuditEventDto } from '@power-budget/shared-app/contract';
import { AmbientField } from '../../glass/material/AmbientField.js';
import { AuditLogView, type AuditLogViewProps } from './AuditLogView.js';
import { AppearanceView } from './SettingsAppearanceTab.js';
import { SettingsCurrencyTab } from './SettingsCurrencyTab.js';
import { SettingsDataTab } from './SettingsDataTab.js';
import { SettingsLocaleTab } from './SettingsLocaleTab.js';
import { SettingsProfileTab } from './SettingsProfileTab.js';
import { SettingsView } from './SettingsView.js';

const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  margin: 'calc(-1 * var(--pb-glass-space-3xl))',
  minHeight: 600,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

const LAYER: React.CSSProperties = { position: 'relative', zIndex: 1 };

/** Sample household of the D7 spec: Anna (the viewer) and Marek. */
function seedProfile(): void {
  runInAction(() => {
    settingsStore.userId = 'user-anna';
    settingsStore.displayName = 'Anna Kowalska';
    settingsStore.email = 'anna@example.com';
    settingsStore.timezone = 'Europe/Warsaw';
    settingsStore.baseCurrency = 'PLN';
    settingsStore.interestingCurrencies = ['EUR', 'USD'];
  });
}

function event(
  id: string,
  actorId: string,
  action: string,
  occurredAt: string,
  meta: AuditEventDto['meta'],
): AuditEventDto {
  return {
    id,
    householdId: 'hh-1',
    actorId,
    subjectType: 'Plan',
    subjectId: 'plan-oct',
    action,
    occurredAt,
    meta,
  };
}

const EVENTS: readonly AuditEventDto[] = [
  event('e1', 'user-anna', 'PLAN_UPDATED', '2026-10-12T09:30:00.000Z', { planName: 'October' }),
  event('e2', 'user-marek', 'TRANSACTION_MAPPED', '2026-10-11T18:05:00.000Z', {}),
  event('e3', 'user-anna', 'CATEGORY_CREATED', '2026-10-09T07:45:00.000Z', { name: 'Eating out' }),
  event('e4', 'user-marek', 'INVITE_ACCEPTED', '2026-10-02T12:00:00.000Z', {}),
];

function auditProps(overrides: Partial<AuditLogViewProps> = {}): AuditLogViewProps {
  return {
    events: EVENTS,
    loading: false,
    error: false,
    currentUserId: 'user-anna',
    onRetry: noop,
    ...overrides,
  };
}

function noop(): void {
  // Gallery fixtures do not react to input.
}

function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={STAGE}>
      <AmbientField />
      <div style={LAYER}>{children}</div>
    </div>
  );
}

function SettingsStage({
  tab,
  children,
}: {
  tab: string;
  children: React.ReactNode;
}): React.JSX.Element {
  seedProfile();

  return (
    <Stage>
      <MemoryRouter initialEntries={[`/settings/${tab}`]}>
        <SettingsView signingOut={false} onSignOut={noop}>
          {children}
        </SettingsView>
      </MemoryRouter>
    </Stage>
  );
}

export function SettingsProfile(): React.JSX.Element {
  return (
    <SettingsStage tab="profile">
      <SettingsProfileTab />
    </SettingsStage>
  );
}

export function SettingsAppearance(): React.JSX.Element {
  return (
    <SettingsStage tab="appearance">
      <AppearanceView preference="system" onChange={noop} />
    </SettingsStage>
  );
}

export function SettingsLocale(): React.JSX.Element {
  return (
    <SettingsStage tab="locale">
      <SettingsLocaleTab />
    </SettingsStage>
  );
}

export function SettingsCurrency(): React.JSX.Element {
  return (
    <SettingsStage tab="currency">
      <SettingsCurrencyTab />
    </SettingsStage>
  );
}

export function SettingsData(): React.JSX.Element {
  return (
    <SettingsStage tab="data">
      <SettingsDataTab />
    </SettingsStage>
  );
}

export function AuditLog(): React.JSX.Element {
  return (
    <Stage>
      <AuditLogView {...auditProps()} />
    </Stage>
  );
}

export function AuditLogEmpty(): React.JSX.Element {
  return (
    <Stage>
      <AuditLogView {...auditProps({ events: [] })} />
    </Stage>
  );
}

export function AuditLogLoading(): React.JSX.Element {
  return (
    <Stage>
      <AuditLogView {...auditProps({ events: [], loading: true })} />
    </Stage>
  );
}

export function AuditLogError(): React.JSX.Element {
  return (
    <Stage>
      <AuditLogView {...auditProps({ events: [], error: true })} />
    </Stage>
  );
}
