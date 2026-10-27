import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Button } from '../components/Button.js';

function reloadPage(): void {
  window.location.reload();
}

/** Replaces the app when a screen crashes or its chunk cannot load; offers a reload. */
export function AppCrashFallback(): React.JSX.Element {
  return (
    <div role="alert" style={{ padding: 'var(--pb-glass-space-lg)' }}>
      <p>
        <FormattedMessage
          id="shell.crash.message"
          defaultMessage="Something went wrong. Reloading the page usually fixes it."
        />
      </p>
      <Button onClick={reloadPage}>
        <FormattedMessage id="shell.crash.reload" defaultMessage="Reload" />
      </Button>
    </div>
  );
}
