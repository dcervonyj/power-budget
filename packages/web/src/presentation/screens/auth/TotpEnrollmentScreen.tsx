import React from 'react';
import { FormattedMessage } from 'react-intl';

export function TotpEnrollmentScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.totpEnrollment.title" defaultMessage="TOTP Enrollment" />
    </div>
  );
}
