import React from 'react';
import { FormattedMessage } from 'react-intl';

/** Shown in the layout while a lazily loaded screen arrives; the frame stays in place. */
export function ShellLoading(): React.JSX.Element {
  return (
    <p style={{ margin: 0, padding: 'var(--pb-glass-space-lg)', color: 'var(--pb-glass-dim)' }}>
      <FormattedMessage id="app.loading" defaultMessage="Loading…" />
    </p>
  );
}
