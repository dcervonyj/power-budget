import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';

export interface CustomPeriodValue {
  startDate: string;
  endDate: string;
}

export interface CustomPeriodPickerProps {
  readonly value: CustomPeriodValue;
  readonly onChange: (value: CustomPeriodValue) => void;
}

export function CustomPeriodPicker({
  value,
  onChange,
}: CustomPeriodPickerProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme.color.surface.raised,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.subtle}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    fontSize: theme.fontSize.md,
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: theme.color.text.secondary,
    fontSize: theme.fontSize.sm,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <label style={labelStyle}>
          <FormattedMessage
            id="component.customPeriodPicker.startDateLabel"
            defaultMessage="Start date"
          />
        </label>
        <input
          type="date"
          value={value.startDate}
          onChange={(e) => {
            onChange({ ...value, startDate: e.target.value });
          }}
          aria-label={intl.formatMessage({
            id: 'component.customPeriodPicker.startDateLabel',
            defaultMessage: 'Start date',
          })}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <label style={labelStyle}>
          <FormattedMessage
            id="component.customPeriodPicker.endDateLabel"
            defaultMessage="End date"
          />
        </label>
        <input
          type="date"
          value={value.endDate}
          onChange={(e) => {
            onChange({ ...value, endDate: e.target.value });
          }}
          aria-label={intl.formatMessage({
            id: 'component.customPeriodPicker.endDateLabel',
            defaultMessage: 'End date',
          })}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
