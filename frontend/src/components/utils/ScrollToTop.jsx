import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop
 * Handles route-based scroll reset + hash navigation support
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Handle anchor links (#section)
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    // Default: instant scroll to top (best UX for page navigation)
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}