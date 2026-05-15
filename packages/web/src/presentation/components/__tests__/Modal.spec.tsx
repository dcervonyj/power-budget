import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext.js';
import { Modal } from '../Modal.js';
import { darkTheme } from '@power-budget/design-tokens';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
);

describe('Modal', () => {
  it('renders when open', () => {
    render(
      <Modal title="Test Modal" isOpen onClose={() => {}}>
        <p>Content</p>
      </Modal>,
      { wrapper },
    );
    expect(screen.getByText('Test Modal')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(
      <Modal title="Test Modal" isOpen={false} onClose={() => {}}>
        <p>Content</p>
      </Modal>,
      { wrapper },
    );
    expect(screen.queryByText('Test Modal')).toBeNull();
  });

  it('calls onClose when X is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" isOpen onClose={onClose}>
        <p>Content</p>
      </Modal>,
      { wrapper },
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
