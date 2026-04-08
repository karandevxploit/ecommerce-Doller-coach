/**
 * Doller Coach • Motion Design System
 * Global animation variants and transition configurations for Framer Motion.
 */

export const standardTransition = {
  duration: 0.4,
  ease: [0.23, 1, 0.32, 1], // Custom cubic-bezier for a "Luxury Glide"
};

export const snappyTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
};

export const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: standardTransition 
  },
  exit: { 
    opacity: 0, 
    transition: snappyTransition 
  }
};

export const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: standardTransition 
  },
  exit: { 
    opacity: 0, 
    y: 10, 
    transition: snappyTransition 
  }
};

export const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: standardTransition 
  },
  exit: { 
    opacity: 0, 
    x: -40, 
    transition: snappyTransition 
  }
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: standardTransition 
  },
  exit: { 
    opacity: 0, 
    scale: 1.05, 
    transition: snappyTransition 
  }
};

export const modalTransition = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0, 
    transition: { 
      type: "spring", 
      damping: 25, 
      stiffness: 300 
    } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10, 
    transition: snappyTransition 
  }
};
