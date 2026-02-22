import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 mb-4 max-w-md text-center">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
