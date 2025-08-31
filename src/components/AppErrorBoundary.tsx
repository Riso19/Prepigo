import { Component, ReactNode } from 'react';
import { captureException, addBreadcrumb } from '@/lib/obs';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    addBreadcrumb({ category: 'app', message: 'ErrorBoundary caught error', level: 'error' });
    captureException(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    // Simplest recovery: reload the app shell
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">We have logged the error. You can try reloading the app.</p>
            <button onClick={this.handleRetry} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
