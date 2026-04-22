import React, { useState, useMemo } from "react";
import { User } from "lucide-react";

/**
 * Avatar Component
 * Handles image, initials fallback, loading state, and accessibility.
 */
const Avatar = ({
  src,
  name,
  size = "md",
  className = "",
  alt
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const initials = useMemo(() => {
    if (!name) return "";
    return name
      .trim()
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg"
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  const showImage = src && !error;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 ${selectedSize} ${className}`}
      role="img"
      aria-label={name ? `${name}'s profile picture` : "User avatar"}
    >
      {showImage ? (
        <>
          {/* Loading Skeleton */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse">
              <div className="w-1/2 h-1/2 rounded-full bg-slate-200" />
            </div>
          )}

          <img
            src={src}
            alt={alt || name || "User avatar"}
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"
              }`}
            onError={handleError}
            onLoad={handleLoad}
          />
        </>
      ) : (
        <div className="flex items-center justify-center text-slate-600 font-semibold uppercase">
          {initials ? (
            <span>{initials}</span>
          ) : (
            <User size={16} aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(Avatar);