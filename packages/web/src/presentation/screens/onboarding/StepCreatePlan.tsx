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

interface StepCreatePlanProps {
  onSkip: () => void;
}

export const StepCreatePlan = observer(function StepCreatePlan({
  onSkip,
}: StepCreatePlanProps): React.JSX.Element {
  return (
    <div style={STEP_STYLE}>
      <h1 style={STEP_TITLE_STYLE}>
        <FormattedMessage
          id="onboarding.step.createPlan.title"
          defaultMessage="Create your first plan"
        />
      </h1>
      <p style={STEP_TEXT_STYLE}>
        <FormattedMessage
          id="onboarding.step.createPlan.description"
          defaultMessage="A plan lets you set income and expense targets for a period (weekly, monthly, or custom). Map your transactions to planned items to track your actuals."
        />
      </p>
      <div style={STACK_STYLE}>
        <Link to={ROUTE_PATHS.plans} className="pbg-ctl" style={linkButtonStyle(true)}>
          <FormattedMessage
            id="onboarding.step.createPlan.createNow"
            defaultMessage="Create plan"
          />
        </Link>
        <Button variant="secondary" onClick={onSkip}>
          <FormattedMessage id="onboarding.button.skip" defaultMessage="Skip for now" />
        </Button>
      </div>
    </div>
  );
});
