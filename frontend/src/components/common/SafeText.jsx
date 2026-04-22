import { sanitize } from "../../utils/sanitizer";

/**
 * SafeText Component (FINAL)
 * - XSS safe
 * - Handles HTML + plain text
 * - Graceful fallback
 * - Clean UI output
 */

export default function SafeText({ children, className = "" }) {
  // ================= EMPTY HANDLING =================
  if (!children) {
    return (
      <span className={`text-gray-400 text-sm ${className}`}>
        —
      </span>
    );
  }

  // ================= NON-STRING =================
  if (typeof children !== "string") {
    return <span className={className}>{children}</span>;
  }

  // ================= DETECT HTML =================
  const hasHTML = /<\/?[a-z][\s\S]*>/i.test(children);

  // ================= SANITIZE =================
  const cleanHtml = sanitize(children);

  // ================= RENDER =================
  if (hasHTML) {
    return (
      <div
        className={`prose prose-sm max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    );
  }

  // ================= PLAIN TEXT =================
  return (
    <p className={`text-sm text-gray-700 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}