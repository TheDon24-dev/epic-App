import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetails = "";

      try {
        if (this.state.error?.message.startsWith('{')) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.operationType) {
            errorMessage = "You do not have permission to perform this action.";
            errorDetails = `Operation: ${parsedError.operationType}, Path: ${parsedError.path}`;
          }
        } else {
          errorMessage = this.state.error?.message || errorMessage;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Oops! Something went wrong.
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {errorMessage}
              </p>
              {errorDetails && (
                <p className="mt-2 text-center text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded">
                  {errorDetails}
                </p>
              )}
            </div>
            <div className="mt-8 text-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
