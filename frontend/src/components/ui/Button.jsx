import React from "react";
import clsx from "clsx";

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
    "inline-flex items-center justify-center gap-2 rounded-lg font-black uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/15 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-slate-950 text-white hover:bg-black shadow-sm hover:shadow-md",
    outline: "border border-slate-300 bg-white text-slate-950 hover:border-slate-950 hover:bg-slate-950 hover:text-white",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
    icon: "p-2 text-slate-700 hover:bg-slate-100",
    quantity: "px-3 py-1 bg-slate-100 hover:bg-slate-200 font-semibold",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[10px]",
    md: "px-4 py-2.5 text-xs",
    lg: "px-6 py-3 text-sm",
  };

  const selectedVariant = variants[variant] || variants.primary;
  const selectedSize = sizes[size] || sizes.md;
  const isCompact = variant === "icon" || variant === "quantity";

  const spinnerClass =
    variant === "primary" || variant === "danger"
      ? "border-white/60 border-t-transparent"
      : "border-current/40 border-t-transparent";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        base,
        selectedVariant,
        !isCompact && selectedSize,
        className
      )}
      {...props}
    >
      {loading ? (
        <span
          className={clsx(
            "w-4 h-4 border-2 rounded-full animate-spin",
            spinnerClass
          )}
        />
      ) : (
        children
      )}
    </button>
  );
};

Button.displayName = "Button";

export default React.memo(Button);
