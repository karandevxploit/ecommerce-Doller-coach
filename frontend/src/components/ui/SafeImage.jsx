import { useState, useEffect, useMemo } from "react";
import { FALLBACK_IMAGE_URL, resolveImageUrl } from "../../utils/url";

const FALLBACK_IMAGE = FALLBACK_IMAGE_URL;

export default function SafeImage({
  src,
  alt = "Product Image",
  className = "",
  wrapperClassName = "",
  priority = false,
  ...props
}) {
  const resolvedSrc = useMemo(() => {
    return resolveImageUrl(src) || FALLBACK_IMAGE;
  }, [src]);

  const [imageSrc, setImageSrc] = useState(resolvedSrc);
  const [error, setError] = useState(false);

  useEffect(() => {
    setImageSrc(resolvedSrc);
    setError(false);
  }, [resolvedSrc]);

  const handleError = () => {
    if (imageSrc !== FALLBACK_IMAGE) {
      setImageSrc(FALLBACK_IMAGE);
      return;
    }

    setError(true);
  };

  return (
    <div
      className={`relative overflow-hidden bg-slate-50 ${wrapperClassName}`}
      role="img"
      aria-label={alt}
    >
      {error ? (
        <div className="absolute inset-0 bg-slate-100" />
      ) : (
        <img
          src={imageSrc || FALLBACK_IMAGE}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding={priority ? "sync" : "async"}
          onError={handleError}
          className={`w-full h-full object-cover opacity-100 ${className}`}
          {...props}
        />
      )}
    </div>
  );
}
