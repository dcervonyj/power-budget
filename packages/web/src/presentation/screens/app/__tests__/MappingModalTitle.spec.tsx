import React from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { MappingModal } from '../../../components/MappingModal.js';
import { darkTheme } from '@power-budget/design-tokens';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';
import pl from '../../../../../public/locales/pl.json';
import ru from '../../../../../public/locales/ru.json';
import uk from '../../../../../public/locales/uk.json';

const apiSpies = spyOnApiClient();

beforeEach(() => {
  apiSpies.get.mockResolvedValue({ status: 200, data: [], headers: {} });
});

function renderTitle(locale: string, messages: Record<string, string>, count: number): void {
  const selectedIds = Array.from({ length: count }, (_, index) => `tx${index}`);

  render(
    <IntlProvider locale={locale} messages={messages}>
      <ThemeProvider theme={darkTheme}>
        <MappingModal isOpen selectedIds={selectedIds} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ThemeProvider>
    </IntlProvider>,
  );
}

describe('MappingModal title plural', () => {
  it('uses the singular for one transaction and the plural for two (en)', async () => {
    renderTitle('en', {}, 1);
    expect(await screen.findByText('Map 1 transaction')).toBeTruthy();
  });

  it('uses the plural for two transactions (en)', async () => {
    renderTitle('en', {}, 2);
    expect(await screen.findByText('Map 2 transactions')).toBeTruthy();
  });

  it('picks the few form in Polish', async () => {
    renderTitle('pl', pl, 2);
    expect(await screen.findByText('Przypisz 2 transakcje')).toBeTruthy();
  });

  it('picks the many form in Polish', async () => {
    renderTitle('pl', pl, 5);
    expect(await screen.findByText('Przypisz 5 transakcji')).toBeTruthy();
  });

  it('picks the few form in Ukrainian', async () => {
    renderTitle('uk', uk, 3);
    expect(await screen.findByText('Зіставити 3 транзакції')).toBeTruthy();
  });

  it('picks the many form in Russian', async () => {
    renderTitle('ru', ru, 5);
    expect(await screen.findByText('Сопоставить 5 транзакций')).toBeTruthy();
  });
});
