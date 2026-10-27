import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { Button } from '../../components/Button.js';
import '../../glass/controls/controls.css';
import {
  STACK_STYLE,
  STEP_STYLE,
  STEP_TEXT_STYLE,
  STEP_TITLE_STYLE,
  linkButtonStyle,
} from './onboardingStyles.js';

interface StepBankConnectProps {
  onSkip: () => void;
}

export const StepBankConnect = observer(function StepBankConnect({
  onSkip,
}: StepBankConnectProps): React.JSX.Element {
  return (
    <div style={STEP_STYLE}>
      <h1 style={STEP_TITLE_STYLE}>
        <FormattedMessage
          id="onboarding.step.bankConnect.title"
          defaultMessage="Connect your bank"
        />
      </h1>
      <p style={STEP_TEXT_STYLE}>
        <FormattedMessage
          id="onboarding.step.bankConnect.description"
          defaultMessage="Link your bank accounts to automatically import transactions. We support GoCardless (PSD2) and Wise."
        />
      </p>
      <div style={STACK_STYLE}>
        <Link to={ROUTE_PATHS.bankConnections} className="pbg-ctl" style={linkButtonStyle(true)}>
          <FormattedMessage
            id="onboarding.step.bankConnect.connectNow"
            defaultMessage="Connect now"
          />
        </Link>
        <Button variant="secondary" onClick={onSkip}>
          <FormattedMessage id="onboarding.button.skip" defaultMessage="Skip for now" />
        </Button>
      </div>
    </div>
  );
});
