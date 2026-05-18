import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

const isDevelopment = () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.DEV;
  }

  return false;
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[ERROR_BOUNDARY]", error, errorInfo);

    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.hasError &&
      this.props.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetBoundary();
    }
  }

  resetBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (typeof this.props.onReset === "function") {
      this.props.onReset();
    }
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  renderFallback() {
    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error: this.state.error,
        resetErrorBoundary: this.resetBoundary,
      });
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mb-5 border">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-gray-500 max-w-sm mb-6">
          We're having trouble loading this page. Please try again.
        </p>

        <button
          type="button"
          onClick={this.handleReload}
          className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-lg text-sm hover:opacity-90 transition"
        >
          <RefreshCw size={14} />
          Refresh page
        </button>

        {isDevelopment() && this.state.error && (
          <pre className="mt-6 text-xs text-red-400 max-w-md overflow-auto text-left">
            {String(this.state.error)}
          </pre>
        )}
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children || null;
  }
}
