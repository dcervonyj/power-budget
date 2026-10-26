import React from 'react';
import { AmbientField } from '../glass/material/AmbientField.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { useMediaQuery } from '../theme/mediaQuery.js';
import { SHELL_COMPACT_QUERY } from './AppShellView.js';
import { Brand } from './Brand.js';

export interface AuthLayoutViewProps {
  /** The language picker in the top bar. */
  readonly language: React.ReactNode;
  readonly children: React.ReactNode;
}

/** Auth and onboarding frame (props only): one frosted card on the ambient light field. */
export function AuthLayoutView({ language, children }: AuthLayoutViewProps): React.JSX.Element {
  const compact = useMediaQuery(SHELL_COMPACT_QUERY);

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
      <AmbientField glowPosition={{ top: '22%', left: '30%' }} />
      <header
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 'var(--pb-glass-space-md)',
          maxWidth: 960,
          margin: '0 auto',
          padding: compact ? '16px 16px 0' : '24px 24px 0',
        }}
      >
        <Brand link={false} />
        <div style={{ width: 200, maxWidth: '100%' }}>{language}</div>
      </header>
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'center',
          padding: compact ? '24px 12px 48px' : '56px 24px 80px',
        }}
      >
        <GlassPanel
          material="frosted"
          depth={1}
          decor={{ specular: true, film: true }}
          rise={0}
          style={{ width: '100%', maxWidth: 480, minWidth: 0 }}
          contentStyle={{ padding: compact ? 24 : 40 }}
        >
          {children}
        </GlassPanel>
      </main>
    </div>
  );
}
