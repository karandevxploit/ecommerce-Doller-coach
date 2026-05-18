import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (hash) {
      const timer = setTimeout(() => {
        try {
          const id = decodeURIComponent(hash.replace("#", ""));
          const element =
            document.getElementById(id) || document.querySelector(hash);

          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      }, 0);

      return () => clearTimeout(timer);
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname, hash]);

  return null;
}
