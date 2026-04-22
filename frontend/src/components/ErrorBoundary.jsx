import React from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

/**
 * ErrorBoundary
 * Handles UI crashes gracefully with recovery options
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary:", error, info);
    }
    // TODO: send to monitoring service (Sentry, etc.)
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-white px-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md w-full text-center">

            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle size={26} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-2">
              Something went wrong
            </h2>

            {/* Message */}
            <p className="text-sm text-slate-500 mb-6">
              The page didn’t load properly. You can try again or go back to the homepage.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">

              {/* Retry */}
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                <RefreshCcw size={16} />
                Try again
              </button>

              {/* Reload */}
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                <RefreshCcw size={16} />
                Reload page
              </button>

              {/* Home */}
              <button
                onClick={this.handleHome}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                <Home size={16} />
                Go home
              </button>

            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;