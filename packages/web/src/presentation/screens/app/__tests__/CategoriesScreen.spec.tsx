import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import type { CategoryDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { CategoriesScreen } from '../CategoriesScreen.js';
import { apiClient } from '../../../../AppProviders.js';

vi.mock('../../../../AppProviders.js', async () => {
  const { CategoriesApi } = await import('@power-budget/shared-app');
  const client = {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return { apiClient: client, categoriesApi: new CategoriesApi(client) };
});

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

function category(overrides: Partial<CategoryDto>): CategoryDto {
  return {
    id: 'cat-1',
    name: 'Groceries',
    kind: 'expense',
    icon: 'tag',
    color: '#6B7280',
    isSystem: false,
    seedKey: null,
    privacy: 'full_detail',
    archived: false,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const own = category({ id: 'cat-own', name: 'Hobbies' });
const system = category({ id: 'cat-sys', name: 'Rent', isSystem: true, seedKey: 'expense.rent' });

function ok<T>(data: T): { status: number; data: T; headers: Record<string, string> } {
  return { status: 200, data, headers: {} };
}

function apiError(status: number): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: {} } });
}

function renderScreen(): void {
  render(
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>
        <CategoriesScreen />
      </ThemeProvider>
    </IntlProvider>,
  );
}

describe('CategoriesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(ok([own, system]));
  });

  it('lists archived categories too and shows system categories read-only', async () => {
    renderScreen();

    expect(await screen.findByDisplayValue('Hobbies')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith('/categories?includeArchived=true');
    const systemRow = screen.getByTestId('category-row-cat-sys');
    expect(systemRow.textContent).toContain('Rent');
    expect(systemRow.textContent).toContain('Built-in');
    expect(systemRow.querySelector('input')).toBeNull();
    expect(systemRow.querySelector('select')).toBeNull();
  });

  it('sends a privacy change and keeps the API answer', async () => {
    mockPatch.mockResolvedValueOnce(ok({ ...own, privacy: 'total_only' }));
    renderScreen();
    await screen.findByDisplayValue('Hobbies');

    fireEvent.change(screen.getByTestId('category-row-cat-own').querySelector('select')!, {
      target: { value: 'total_only' },
    });

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/categories/cat-own', { privacy: 'total_only' });
    });
  });

  it('rolls a rename back and explains a 409', async () => {
    mockPatch.mockRejectedValueOnce(apiError(409));
    renderScreen();
    const input = await screen.findByDisplayValue('Hobbies');

    fireEvent.change(input, { target: { value: 'Rent' } });
    fireEvent.blur(input);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'A category with this name already exists.',
    );
    expect(mockPatch).toHaveBeenCalledWith('/categories/cat-own', { name: 'Rent' });
    expect(screen.getByDisplayValue('Hobbies')).toBeTruthy();
  });

  it('creates a category with the chosen kind', async () => {
    mockPost.mockResolvedValueOnce(ok(category({ id: 'cat-new', name: 'Salary', kind: 'income' })));
    renderScreen();
    await screen.findByDisplayValue('Hobbies');

    fireEvent.change(screen.getByPlaceholderText('New category name'), {
      target: { value: ' Salary ' },
    });
    fireEvent.change(document.getElementById('new-category-kind')!, {
      target: { value: 'income' },
    });
    fireEvent.click(screen.getByText('Add category'));

    expect(await screen.findByDisplayValue('Salary')).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith('/categories', { name: 'Salary', kind: 'income' });
  });
});
