import {
  Component,
  type ComponentType,
  type GetDerivedStateFromError,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

export interface ErrorBoundaryProps extends PropsWithChildren {
  fallback?: ReactNode | ComponentType<{ error: unknown; reset: () => void }>;
}

interface ErrorBoundaryState {
  error?: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError: GetDerivedStateFromError<ErrorBoundaryProps, ErrorBoundaryState> = (error) => ({ error });

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  resetError = () => {
    this.setState({});
  };

  render() {
    const {
      state: { error },
      props: { fallback: Fallback, children },
    } = this;

    if ('error' in this.state) {
      if (typeof Fallback === 'function') {
        return <Fallback error={error} reset={this.resetError} />;
      }
      return Fallback ?? null;
    }
    return children;
  }
}
