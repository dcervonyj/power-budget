import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { CountBadge } from './CountBadge.js';
import { FilterChips } from './FilterChips.js';
import { IconButton } from './IconButton.js';
import { Keypad } from './Keypad.js';
import { SegmentedControl } from './SegmentedControl.js';
import { Stepper } from './Stepper.js';
import { Switch } from './Switch.js';

const LABEL = {
  primary: 'Primary',
  secondary: 'Secondary',
  danger: 'Danger',
  disabled: 'Disabled',
  loading: 'Loading',
  plus: '+',
};

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'over', label: 'Over' },
  { value: 'paid', label: 'Paid' },
];

const useStyles = makeStyles((glass) => ({
  section: { gap: glass.space.sm, marginBottom: glass.space.lg },
  heading: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.heading.mobile,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: glass.space.md },
  glyph: { color: glass.colors.fg, fontSize: glass.type.panelLabel.mobile },
}));

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Buttons in every variant and state. */
export function Buttons(): React.JSX.Element {
  return (
    <Section title="Buttons">
      <Button variant="primary">{LABEL.primary}</Button>
      <Button variant="secondary">{LABEL.secondary}</Button>
      <Button variant="danger">{LABEL.danger}</Button>
      <Button variant="primary" disabled>
        {LABEL.disabled}
      </Button>
      <Button variant="secondary" loading>
        {LABEL.loading}
      </Button>
    </Section>
  );
}

/** Text input default and error state, and a select field. */
export function Fields(): React.JSX.Element {
  return (
    <Section title="Fields">
      <Input label="Email" placeholder="you@example.com" value="" onChangeText={noop} />
      <Input label="Password" value="secret" secureTextEntry onChangeText={noop} />
      <Input label="Amount" value="12x" error="Enter a number" onChangeText={noop} />
      <Select label="Category" options={OPTIONS} value="over" onChange={noop} />
    </Section>
  );
}

/** Switch, stepper, icon button and count badge. */
export function Toggles(): React.JSX.Element {
  const styles = useStyles();
  const [on, setOn] = useState(true);
  const [days, setDays] = useState(3);

  return (
    <Section title="Toggles">
      <View style={styles.row}>
        <Switch label="Sync on" checked={on} onChange={setOn} />
        <Switch label="Sync off" checked={false} onChange={noop} />
        <Switch label="Sync locked" checked disabled onChange={noop} />
      </View>
      <Stepper
        label="Days"
        value={days}
        min={0}
        max={10}
        decrementLabel="Fewer days"
        incrementLabel="More days"
        onChange={setDays}
      />
      <View style={styles.row}>
        <IconButton label="Add">
          <Text style={styles.glyph}>{LABEL.plus}</Text>
        </IconButton>
        <IconButton label="Add disabled" disabled>
          <Text style={styles.glyph}>{LABEL.plus}</Text>
        </IconButton>
        <CountBadge count={3} />
        <CountBadge count={120} />
      </View>
    </Section>
  );
}

/** Filter chips and segmented control. */
export function Choices(): React.JSX.Element {
  const [chip, setChip] = useState('all');
  const [segment, setSegment] = useState('over');

  return (
    <Section title="Choices">
      <FilterChips label="Filter" options={OPTIONS} value={chip} onChange={setChip} />
      <SegmentedControl label="Mode" options={OPTIONS} value={segment} onChange={setSegment} />
    </Section>
  );
}

/** Amount keypad. */
export function AmountKeypad(): React.JSX.Element {
  const [value, setValue] = useState('84.5');

  return (
    <Section title="Keypad">
      <Keypad value={value} onChange={setValue} submitLabel="Save" backspaceLabel="Delete" />
    </Section>
  );
}

function noop(): void {}
