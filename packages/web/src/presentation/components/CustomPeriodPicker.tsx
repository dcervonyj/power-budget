import React, { useId } from 'react';
import { useIntl } from 'react-intl';
import '../glass/controls/controls.css';

export interface CustomPeriodValue {
  startDate: string;
  endDate: string;
}

export interface CustomPeriodPickerProps {
  readonly value: CustomPeriodValue;
  readonly onChange: (value: CustomPeriodValue) => void;
}

const GROUP_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 'var(--pb-glass-space-md)',
};

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xxs)',
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const INPUT_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
  colorScheme: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
};

export function CustomPeriodPicker({
  value,
  onChange,
}: CustomPeriodPickerProps): React.JSX.Element {
  const intl = useIntl();
  const startId = useId();
  const endId = useId();
  const startLabel = intl.formatMessage({
    id: 'component.customPeriodPicker.startDateLabel',
    defaultMessage: 'Start date',
  });
  const endLabel = intl.formatMessage({
    id: 'component.customPeriodPicker.endDateLabel',
    defaultMessage: 'End date',
  });

  return (
    <div style={GROUP_STYLE}>
      <div style={FIELD_STYLE}>
        <label htmlFor={startId} style={LABEL_STYLE}>
          {startLabel}
        </label>
        <input
          id={startId}
          type="date"
          value={value.startDate}
          onChange={(e) => {
            onChange({ ...value, startDate: e.target.value });
          }}
          className="pbg-ctl pbg-ctl-field"
          style={INPUT_STYLE}
        />
      </div>
      <div style={FIELD_STYLE}>
        <label htmlFor={endId} style={LABEL_STYLE}>
          {endLabel}
        </label>
        <input
          id={endId}
          type="date"
          value={value.endDate}
          onChange={(e) => {
            onChange({ ...value, endDate: e.target.value });
          }}
          className="pbg-ctl pbg-ctl-field"
          style={INPUT_STYLE}
        />
      </div>
    </div>
  );
}
