import React from 'react';
import { FormattedMessage } from 'react-intl';

export function AuditLogScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.auditLog.title" defaultMessage="Audit Log" />
    </div>
  );
}
