import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Rod } from '../../glass/light/Rod.js';

export interface StepIndicatorProps {
  /** Zero-based index of the current step. */
  readonly index: number;
  readonly total: number;
}

const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
};

const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

/** Progress as a small rod: the light grows with every finished step. */
export function StepIndicator({ index, total }: StepIndicatorProps): React.JSX.Element {
  const intl = useIntl();
  const current = index + 1;

  return (
    <div style={WRAP_STYLE}>
      <Rod
        rod={{
          fraction: current / total,
          state: 'under',
          size: 'category',
          ariaLabel: intl.formatMessage(
            { id: 'onboarding.progress', defaultMessage: 'Step {current} of {total}' },
            { current, total },
          ),
        }}
      />
      <p style={CAPTION_STYLE}>
        <FormattedMessage
          id="onboarding.progress"
          defaultMessage="Step {current} of {total}"
          values={{ current, total }}
        />
      </p>
    </div>
  );
}
