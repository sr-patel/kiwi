import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { HttpError } from '@/services/apiClient';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isNetworkError: boolean;
}

export class ApiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isNetworkError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Classify on type rather than loose substring matching: treating every
    // TypeError as a network failure mislabelled ordinary render bugs.
    const isNetworkError =
      error instanceof HttpError
        ? error.status >= 500 || error.status === 408 || error.status === 429
        : error.name === 'TimeoutError' ||
          error.name === 'TypeError' ||
          /Failed to fetch|NetworkError|ENOBUFS/i.test(error.message);

    return {
      hasError: true,
      error,
      isNetworkError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('API Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      isNetworkError: false,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, isNetworkError } = this.state;

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-center w-16 h-16 mb-4 bg-red-100 dark:bg-red-900 rounded-full">
            {isNetworkError ? (
              <WifiOff className="w-8 h-8 text-red-600 dark:text-red-400" />
            ) : (
              <Wifi className="w-8 h-8 text-red-600 dark:text-red-400" />
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {isNetworkError ? 'Connection Error' : 'API Error'}
          </h3>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-4 max-w-md">
            {isNetworkError
              ? 'Unable to connect to the server. Please check your internet connection and try again.'
              : 'There was an error loading data. Please try again.'}
          </p>

          {import.meta.env.DEV && error && (
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 max-w-md">
              <strong>Error:</strong> {error.message}
            </div>
          )}

          <button
            type="button"
            onClick={this.handleRetry}
            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
