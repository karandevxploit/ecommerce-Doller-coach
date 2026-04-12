import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop - A performance-optimized utility component that resets
 * the scroll position to the top of the viewport on every route change.
 *
 * Placed within the BrowserRouter to tap into the location context.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Using 'instant' for a seamless transition between views.
    // This prevents the user from seeing the 'previous' page scroll up
    // before the new content is rendered, which is the standard for high-end UX.
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth" 
    });
  }, [pathname]);

  return null;
}
