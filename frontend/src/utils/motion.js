/**
 * Motion Design System (Production-Ready)
 * - Accessible (reduced motion)
 * - Reusable (dynamic variants)
 * - Consistent across app
 */

/* ---------------- ACCESSIBILITY ---------------- */
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------- BASE TRANSITIONS ---------------- */
export const standardTransition = prefersReducedMotion
  ? { duration: 0 }
  : {
    duration: 0.4,
    ease: [0.23, 1, 0.32, 1],
  };

export const snappyTransition = prefersReducedMotion
  ? { duration: 0 }
  : {
    duration: 0.25,
    ease: [0.4, 0, 0.2, 1],
  };

export const springTransition = prefersReducedMotion
  ? { duration: 0 }
  : {
    type: "spring",
    stiffness: 400,
    damping: 25,
  };

/* ---------------- STAGGER ---------------- */
export const staggerContainer = (
  staggerChildren = 0.08,
  delayChildren = 0
) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: prefersReducedMotion
        ? 0
        : staggerChildren,
      delayChildren,
    },
  },
});

/* ---------------- FADE ---------------- */
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: standardTransition,
  },
  exit: {
    opacity: 0,
    transition: snappyTransition,
  },
};

/* ---------------- SLIDE (DYNAMIC) ---------------- */
export const slide = ({
  direction = "up",
  distance = 20,
} = {}) => {
  const axis =
    direction === "left" || direction === "right"
      ? "x"
      : "y";

  const value =
    direction === "left" || direction === "up"
      ? -distance
      : distance;

  return {
    hidden: {
      opacity: 0,
      [axis]: prefersReducedMotion ? 0 : value,
    },
    visible: {
      opacity: 1,
      [axis]: 0,
      transition: standardTransition,
    },
    exit: {
      opacity: 0,
      [axis]: prefersReducedMotion
        ? 0
        : value / 2,
      transition: snappyTransition,
    },
  };
};

/* ---------------- SCALE ---------------- */
export const scaleIn = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: standardTransition,
  },
  exit: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 1.05,
    transition: snappyTransition,
  },
};

/* ---------------- MODAL ---------------- */
export const modal = {
  hidden: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 0.95,
    y: prefersReducedMotion ? 0 : 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 0.98,
    y: prefersReducedMotion ? 0 : 10,
    transition: snappyTransition,
  },
};

/* ---------------- LIST ITEM ---------------- */
export const listItem = {
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: snappyTransition,
  },
};

/* ---------------- BUTTON TAP ---------------- */
export const buttonTap = {
  whileTap: prefersReducedMotion
    ? {}
    : { scale: 0.96 },
};

/* ---------------- HOVER SCALE ---------------- */
export const hoverScale = {
  whileHover: prefersReducedMotion
    ? {}
    : { scale: 1.03 },
};