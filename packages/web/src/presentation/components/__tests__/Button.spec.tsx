import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../ThemeContext.js';
import { Button } from '../Button.js';
import { darkTheme } from '@power-budget/design-tokens';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>, { wrapper });
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('shows loading indicator', () => {
    render(<Button loading>Click me</Button>, { wrapper });
    expect(screen.getByRole('button').textContent).toBe('…');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>, { wrapper });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>, { wrapper });
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
