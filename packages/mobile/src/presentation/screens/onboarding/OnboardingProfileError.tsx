import React from 'react';
import { useIntl } from 'react-intl';
import { Button } from '../../components/Button.js';
import { AuthLayout, AuthNotice } from '../auth/AuthParts.js';

export interface OnboardingProfileErrorProps {
  readonly onRetry: () => void;
}

/** The profile could not be read, so we do not know if onboarding is done: stay here, retry. */
export function OnboardingProfileError({
  onRetry,
}: OnboardingProfileErrorProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <AuthLayout>
      <AuthNotice
        message={intl.formatMessage({
          id: 'onboarding.profileError',
          defaultMessage: 'Failed to load your profile',
        })}
      />
      <Button onPress={onRetry}>
        {intl.formatMessage({ id: 'onboarding.retry', defaultMessage: 'Retry' })}
      </Button>
    </AuthLayout>
  );
}
