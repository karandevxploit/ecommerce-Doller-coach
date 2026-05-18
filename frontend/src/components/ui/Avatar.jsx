import React, { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";

const sizeClasses = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

const iconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
};

const getInitials = (name) => {
  const cleanName = String(name || "").trim();

  if (!cleanName) return "";

  return cleanName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const Avatar = ({
  src = "",
  name = "",
  size = "md",
  className = "",
  alt,
}) => {
  const safeSrc = String(src || "").trim();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(safeSrc));

  const initials = useMemo(() => getInitials(name), [name]);
  const selectedSize = sizeClasses[size] || sizeClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;
  const showImage = Boolean(safeSrc) && !error;

  useEffect(() => {
    setError(false);
    setLoading(Boolean(safeSrc));
  }, [safeSrc]);

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 ${selectedSize} ${className}`}
      role="img"
      aria-label={name ? `${name}'s profile picture` : "User avatar"}
    >
      {showImage ? (
        <>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse">
              <div className="w-1/2 h-1/2 rounded-full bg-slate-200" />
            </div>
          )}

          <img
            src={safeSrc}
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
          {initials ? <span>{initials}</span> : <User size={iconSize} aria-hidden="true" />}
        </div>
      )}
    </div>
  );
};

Avatar.displayName = "Avatar";

export default React.memo(Avatar);
