import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import type { CategoryRowData, TxRowData } from '@power-budget/shared-app';
import { CategoryRow } from '../CategoryRow.js';
import { TxRow } from '../TxRow.js';

const ROW_LOCALES = ['en', 'pl', 'uk', 'ru'] as const;
const NBSP = /[  ]/g;

function loadMessages(locale: string): Record<string, string> {
  const dir = resolve(process.cwd(), 'public/locales', locale);
  const rows = JSON.parse(readFileSync(resolve(dir, 'glass-rows.json'), 'utf8'));
  const light = JSON.parse(readFileSync(resolve(dir, 'glass-light.json'), 'utf8'));

  return { ...light, ...rows };
}

function renderEn(element: React.ReactElement): void {
  render(
    <IntlProvider locale="en" messages={loadMessages('en')}>
      {element}
    </IntlProvider>,
  );
}

function groupName(): string {
  return (screen.getByRole('group').getAttribute('aria-label') ?? '').replace(NBSP, ' ');
}

const BASE: TxRowData = {
  id: 'tx-1',
  title: 'Lidl',
  subtitle: '18 Oct',
  amountMinor: -8740n,
  currency: 'PLN',
  status: 'booked',
};

const CATEGORY: CategoryRowData = {
  id: 'cat-1',
  label: 'Groceries',
  spentMinor: 114864n,
  plannedMinor: 220000n,
  currency: 'PLN',
  status: 'ok',
  paid: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TxRow accessible names', () => {
  it('names a booked row by title, amount and subtitle', () => {
    renderEn(<TxRow transaction={BASE} />);

    expect(groupName()).toBe('Lidl, −zł 87.40, 18 Oct');
  });

  it('adds "just synced" for a live row and shows the Just in tag', () => {
    renderEn(<TxRow transaction={BASE} live />);

    expect(groupName()).toContain('just synced');
    expect(screen.getByText('Just in')).toBeInTheDocument();
  });

  it('names a pending row and shows the Pending tag', () => {
    renderEn(<TxRow transaction={{ ...BASE, status: 'pending' }} />);

    expect(groupName()).toContain('pending');
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('names a transfer, tags it and renders its amount dim', () => {
    renderEn(<TxRow transaction={{ ...BASE, status: 'transfer', amountMinor: 100000n }} />);

    expect(groupName()).toContain('transfer');
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByTestId('tx-amount').style.color).toBe('var(--pb-glass-dim)');
  });

  it('names a to-sort row with its suggestion and shows the percentage', () => {
    renderEn(
      <TxRow
        transaction={{
          ...BASE,
          status: 'to-sort',
          suggestionLabel: 'Groceries',
          suggestionConfidence: 0.88,
        }}
      />,
    );

    expect(groupName()).toContain('to sort, suggested Groceries');
    expect(screen.getByText(/Suggested: Groceries 88%/)).toBeInTheDocument();
  });

  it('names a to-sort row without a suggestion', () => {
    renderEn(<TxRow transaction={{ ...BASE, status: 'to-sort' }} />);

    expect(groupName()).toContain('to sort, no suggestion');
  });

  it('shows the provenance tag', () => {
    renderEn(<TxRow transaction={BASE} provenance="rule" />);

    expect(screen.getByText('By rule')).toBeInTheDocument();
  });
});

describe('TxRow actions', () => {
  const TO_SORT: TxRowData = { ...BASE, status: 'to-sort', suggestionLabel: 'Groceries' };

  it('calls confirm and choose with the transaction id', () => {
    const onConfirm = vi.fn();
    const onChoose = vi.fn();
    renderEn(
      <TxRow transaction={TO_SORT} onConfirmSuggestion={onConfirm} onChooseCategory={onChoose} />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the suggested category for Lidl' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose a category for Lidl' }));

    expect(onConfirm).toHaveBeenCalledWith('tx-1');
    expect(onChoose).toHaveBeenCalledWith('tx-1');
  });

  it('shows Undo instead of Confirm once the suggestion is applied', () => {
    const onUndo = vi.fn();
    renderEn(<TxRow transaction={TO_SORT} suggestionApplied onUndoSuggestion={onUndo} />);

    fireEvent.click(screen.getByRole('button', { name: 'Undo the category for Lidl' }));

    expect(onUndo).toHaveBeenCalledWith('tx-1');
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
    expect(screen.getByText('Sorted into Groceries')).toBeInTheDocument();
  });

  it('offers only Choose when there is no suggestion', () => {
    const onChoose = vi.fn();
    renderEn(<TxRow transaction={{ ...BASE, status: 'to-sort' }} onChooseCategory={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose a category for Lidl' }));

    expect(onChoose).toHaveBeenCalledWith('tx-1');
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
  });

  it('opens the transaction from the main button', () => {
    const onPress = vi.fn();
    renderEn(<TxRow transaction={BASE} onPress={onPress} />);

    fireEvent.click(screen.getByRole('button', { name: /Lidl/ }));

    expect(onPress).toHaveBeenCalledWith('tx-1');
  });

  it('has no buttons on a booked row without callbacks', () => {
    renderEn(<TxRow transaction={BASE} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('CategoryRow', () => {
  it('shows the rod, the amount left and the status tag', () => {
    renderEn(<CategoryRow category={CATEGORY} />);

    expect(groupName()).toBe('Groceries: zł 1,148.64 spent');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('left of');
    expect(screen.getByTestId('category-left').textContent).toContain('left');
    expect(screen.getByText('Under plan')).toBeInTheDocument();
  });

  it('shows the over state with an over-by tag', () => {
    renderEn(
      <CategoryRow
        category={{ ...CATEGORY, spentMinor: 56250n, plannedMinor: 50000n, status: 'over' }}
      />,
    );

    expect(screen.getByTestId('rod-tag').textContent).toContain('Over by');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('over by');
  });

  it('shows the paid state', () => {
    renderEn(
      <CategoryRow
        category={{ ...CATEGORY, spentMinor: 340000n, plannedMinor: 340000n, paid: true }}
      />,
    );

    expect(screen.getByTestId('rod-tag').textContent).toContain('Paid');
  });

  it('privacy variant shows only the total: no rod, no plan, no amount left', () => {
    renderEn(<CategoryRow category={{ ...CATEGORY, totalOnly: true }} />);

    expect(groupName()).toBe('Groceries: zł 1,148.64 spent, totals only');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('category-left')).toBeNull();
    expect(screen.queryByText(/of /)).toBeNull();
    expect(screen.getByText('Totals only')).toBeInTheDocument();
  });

  it('calls onPress with the category id', () => {
    const onPress = vi.fn();
    renderEn(<CategoryRow category={CATEGORY} onPress={onPress} />);

    fireEvent.click(screen.getByRole('button', { name: /Groceries/ }));

    expect(onPress).toHaveBeenCalledWith('cat-1');
  });
});

describe('glass-rows locales', () => {
  it('has the same keys in every locale', () => {
    const keys = Object.keys(loadMessages('en')).filter(isRowKey).sort();

    for (const locale of ROW_LOCALES) {
      expect(Object.keys(loadMessages(locale)).filter(isRowKey).sort(), locale).toEqual(keys);
    }
  });

  it.each(['pl', 'uk', 'ru'] as const)('renders a translated to-sort row name in %s', (locale) => {
    render(
      <IntlProvider locale={locale} messages={loadMessages(locale)}>
        <TxRow transaction={{ ...BASE, status: 'to-sort', suggestionLabel: 'X' }} />
      </IntlProvider>,
    );

    expect(groupName()).not.toContain('to sort');
    expect(groupName()).toContain('X');
  });
});

function isRowKey(key: string): boolean {
  return key.startsWith('glass-rows.');
}
