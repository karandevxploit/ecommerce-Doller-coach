import React from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("UI Crash detected:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#ffffff] text-white px-6">

          {/* Background Glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-transparent  rounded-full" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-transparent  rounded-full" />
          </div>

          <div className="max-w-md w-full text-center">

            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 blur-xl bg-red-500/30 rounded-full" />
                <div className="relative h-14 w-14 flex items-center justify-center rounded-2xl bg-[#1e3a8a] shadow-lg">
                  <AlertTriangle size={26} />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
              Something went wrong
            </h2>

            {/* Message */}
            <p className="text-sm text-white/60 mb-8 leading-relaxed">
              We encountered an unexpected issue. Please try refreshing the page or return home.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">

              {/* Reload */}
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all"
              >
                <RefreshCcw size={16} />
                Reload
              </button>

              {/* Home */}
              <button
                onClick={() => (window.location.href = "/")}
                className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all"
              >
                <Home size={16} />
                Home
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