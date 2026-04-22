import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ERROR_BOUNDARY]", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">

          {/* ICON */}
          <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mb-5 border">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>

          {/* TITLE */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>

          {/* MESSAGE */}
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            We’re having trouble loading this page. Please try again.
          </p>

          {/* ACTION */}
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-lg text-sm hover:opacity-90 transition"
          >
            <RefreshCw size={14} />
            Refresh page
          </button>

          {/* OPTIONAL DETAILS (DEV ONLY) */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="mt-6 text-xs text-red-400 max-w-md overflow-auto text-left">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}