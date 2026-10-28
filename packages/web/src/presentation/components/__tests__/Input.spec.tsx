import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../ThemeContext.js';
import { Input } from '../Input.js';
import { darkTheme } from '@power-budget/design-tokens';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" value="" onChange={() => {}} />, { wrapper });
    expect(screen.getByText('Email')).toBeDefined();
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="Enter value" />, { wrapper });
    fireEvent.change(screen.getByPlaceholderText('Enter value'), {
      target: { value: 'test' },
    });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('shows error message', () => {
    render(<Input value="" onChange={() => {}} error="Required" />, { wrapper });
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('announces the error and links it to the input', () => {
    render(<Input value="" onChange={() => {}} error="Required" placeholder="x" />, { wrapper });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Required');
    const input = screen.getByPlaceholderText('x');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
