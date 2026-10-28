import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useIntl } from 'react-intl';
import { Button } from '../../components/Button.js';
import { useGlass } from '../../theme/index.js';
import { AuthHeading, AuthLayout, AuthNotice, AuthStatus } from './AuthParts.js';

export interface OAuthCallbackViewProps {
  readonly failed: boolean;
  readonly onBackToLogin: () => void;
}

export function OAuthCallbackView({
  failed,
  onBackToLogin,
}: OAuthCallbackViewProps): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();
  const loadingLabel = intl.formatMessage({
    id: 'auth.oauth.loading',
    defaultMessage: 'Completing sign in…',
  });

  return (
    <AuthLayout>
      <AuthHeading
        title={intl.formatMessage({ id: 'auth.oauth.title', defaultMessage: 'Sign in' })}
      />
      {failed ? (
        <>
          <AuthNotice
            message={intl.formatMessage({
              id: 'auth.oauth.error',
              defaultMessage: 'Sign in with Google failed. Please try again.',
            })}
          />
          <Button variant="secondary" onPress={onBackToLogin}>
            {intl.formatMessage({ id: 'auth.backToLogin', defaultMessage: 'Back to log in' })}
          </Button>
        </>
      ) : (
        <>
          <ActivityIndicator
            size="large"
            color={glass.colors.accent}
            accessibilityLabel={loadingLabel}
          />
          <AuthStatus>{loadingLabel}</AuthStatus>
        </>
      )}
    </AuthLayout>
  );
}
