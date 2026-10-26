import React, { useState } from 'react';
import { Button } from '../presentation/components/Button.js';
import { Input } from '../presentation/components/Input.js';
import { Select } from '../presentation/components/Select.js';
import { CountBadge } from '../presentation/glass/controls/CountBadge.js';
import { FilterChips } from '../presentation/glass/controls/FilterChips.js';
import { IconButton } from '../presentation/glass/controls/IconButton.js';
import { SegmentedControl } from '../presentation/glass/controls/SegmentedControl.js';
import { Stepper } from '../presentation/glass/controls/Stepper.js';
import { Switch } from '../presentation/glass/controls/Switch.js';
import '../presentation/glass/controls/controls.css';

const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-md)',
  marginBottom: 'var(--pb-glass-space-lg)',
};

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'food', label: 'Food' },
  { value: 'home', label: 'Home' },
];

const GEAR = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <circle cx="9" cy="9" r="3" />
    <path d="M9 1.5v2.5M9 14v2.5M1.5 9H4M14 9h2.5" strokeLinecap="round" />
  </svg>
);

export function Buttons(): React.JSX.Element {
  return (
    <section aria-label="Buttons">
      <div style={ROW}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Delete</Button>
      </div>
      <div style={ROW}>
        <Button disabled>Primary disabled</Button>
        <Button variant="secondary" disabled>
          Secondary disabled
        </Button>
        <Button variant="danger" disabled>
          Danger disabled
        </Button>
      </div>
      <div style={ROW}>
        <span className="pbg-ctl-focus" style={{ borderRadius: 'var(--pb-glass-radius-control)' }}>
          <Button>Focus ring</Button>
        </span>
        <IconButton label="Settings">{GEAR}</IconButton>
        <IconButton label="Settings disabled" disabled>
          {GEAR}
        </IconButton>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Inbox <CountBadge count={3} />
          <CountBadge count={128} />
        </span>
      </div>
    </section>
  );
}

export function Fields(): React.JSX.Element {
  const [name, setName] = useState('Groceries');
  const [period, setPeriod] = useState<string>('month');

  return (
    <section
      aria-label="Fields"
      style={{ display: 'grid', gap: 'var(--pb-glass-space-md)', maxWidth: 360 }}
    >
      <Input id="g-name" label="Name" value={name} onChange={setName} />
      <Input id="g-empty" label="Empty" placeholder="Placeholder" value="" onChange={setName} />
      <Input id="g-error" label="Amount" value="abc" onChange={setName} error="Enter a number" />
      <Input id="g-off" label="Disabled" value="Locked" onChange={setName} state="disabled" />
      <Input id="g-pass" label="Password" type="password" value="secret" onChange={setName} />
      <Select id="g-period" label="Period" options={PERIODS} value={period} onChange={setPeriod} />
      <Select
        id="g-ph"
        label="Placeholder"
        placeholder="Choose"
        options={PERIODS}
        value=""
        onChange={setPeriod}
      />
      <Select
        id="g-off2"
        label="Disabled"
        options={PERIODS}
        value="week"
        onChange={setPeriod}
        disabled
      />
    </section>
  );
}

export function Toggles(): React.JSX.Element {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [qty, setQty] = useState(3);
  const [category, setCategory] = useState('food');
  const [period, setPeriod] = useState('month');

  return (
    <section aria-label="Toggles">
      <div style={ROW}>
        <Switch label="On" checked={on} onChange={setOn} />
        <Switch label="Off" checked={off} onChange={setOff} />
        <Switch label="On disabled" checked disabled onChange={setOn} />
        <Switch label="Off disabled" checked={false} disabled onChange={setOff} />
        <span className="pbg-ctl-focus" style={{ borderRadius: 16 }}>
          <Switch label="Focus" checked={on} onChange={setOn} />
        </span>
      </div>
      <div style={ROW}>
        <Stepper
          label="Quantity"
          decrementLabel="Less"
          incrementLabel="More"
          value={qty}
          min={0}
          max={5}
          onChange={setQty}
        />
        <Stepper
          label="Disabled"
          decrementLabel="Less"
          incrementLabel="More"
          value={2}
          disabled
          onChange={setQty}
        />
      </div>
      <div style={ROW}>
        <FilterChips
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />
        <FilterChips
          label="Disabled"
          options={CATEGORIES}
          value="all"
          disabled
          onChange={setCategory}
        />
      </div>
      <div style={{ ...ROW, maxWidth: 360 }}>
        <SegmentedControl label="Period" options={PERIODS} value={period} onChange={setPeriod} />
      </div>
    </section>
  );
}
