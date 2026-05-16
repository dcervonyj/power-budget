import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from '../ThemeContext.js';
import { ErrorBanner } from './ErrorBanner.js';
import { darkTheme } from '@power-budget/design-tokens';

function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
    </IntlProvider>
  );
}

describe('ErrorBanner', () => {
  it('renders the message', () => {
    render(
      <Wrapper>
        <ErrorBanner message="Something went wrong" />
      </Wrapper>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders retry button and calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(
      <Wrapper>
        <ErrorBanner message="Load failed" onRetry={onRetry} />
      </Wrapper>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(
      <Wrapper>
        <ErrorBanner message="Error without retry" />
      </Wrapper>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has role="alert" for accessibility', () => {
    render(
      <Wrapper>
        <ErrorBanner message="Alert test" />
      </Wrapper>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { container } = render(
      <Wrapper>
        <ErrorBanner message="Snapshot message" onRetry={() => undefined} />
      </Wrapper>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
