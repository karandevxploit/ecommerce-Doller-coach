import React from "react";
import clsx from "clsx";

/**
 * Button Component
 * Supports variants, sizes, loading state, and accessibility
 */
const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md",
    outline:
      "border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white",
    secondary:
      "bg-slate-100 text-slate-800 hover:bg-slate-200",
    danger:
      "bg-red-500 text-white hover:bg-red-600",
    ghost:
      "text-slate-700 hover:bg-slate-100",
    icon:
      "p-2 text-slate-700 hover:bg-slate-100",
    quantity:
      "px-3 py-1 bg-slate-100 hover:bg-slate-200 font-semibold"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        base,
        variants[variant],
        variant !== "icon" && variant !== "quantity" && sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
};

export default React.memo(Button);