import React from 'react';

interface Props {
  fallback: React.ReactNode;
  onError: (error: unknown) => void;
  children?: React.ReactNode;
}

interface State {
  failed: boolean;
}

/** Minimal error boundary so the entry chunk does not need the Sentry React SDK. */
export class ReportingErrorBoundary extends React.Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): React.ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
