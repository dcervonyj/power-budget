import React from 'react';
import { useIntl } from 'react-intl';
import type { RadioOption } from '../glass/controls/RadioGroup.js';
import { SegmentedControl } from '../glass/controls/SegmentedControl.js';
import type { ThemePreference } from '../theme/themePreference.js';

export interface ThemeChoiceProps {
  readonly value: ThemePreference;
  readonly onChange: (value: ThemePreference) => void;
}

/** Appearance: System / Night / Day (Q1), stored per device by the theme runtime. */
export function ThemeChoice({ value, onChange }: ThemeChoiceProps): React.JSX.Element {
  const intl = useIntl();
  const options: ReadonlyArray<RadioOption<ThemePreference>> = [
    {
      value: 'system',
      label: intl.formatMessage({ id: 'shell.theme.system', defaultMessage: 'System' }),
    },
    {
      value: 'dark',
      label: intl.formatMessage({ id: 'shell.theme.dark', defaultMessage: 'Night' }),
    },
    {
      value: 'light',
      label: intl.formatMessage({ id: 'shell.theme.light', defaultMessage: 'Day' }),
    },
  ];

  return (
    <SegmentedControl<ThemePreference>
      label={intl.formatMessage({ id: 'shell.theme.label', defaultMessage: 'Appearance' })}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
