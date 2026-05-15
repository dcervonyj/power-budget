import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext.js';
import { Input } from '../Input.js';
import { darkTheme } from '@power-budget/design-tokens';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
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
});
