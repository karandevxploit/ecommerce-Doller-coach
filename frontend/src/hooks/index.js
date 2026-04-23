// Centralized hooks exports (clean, scalable, consistent)

/* ---------------- CORE HOOKS ---------------- */
export { useForm } from "./useForm";
export { useAutoLogout } from "./useAutoLogout";
export { useRealtime } from "./useRealtime";
export { useSafeInterval } from "./useSafeInterval";

/* ---------------- OPTIONAL DEFAULT EXPORTS (for flexibility) ---------------- */
export { default as useFormHook } from "./useForm";
export { default as useAutoLogoutHook } from "./useAutoLogout";
export { default as useRealtimeHook } from "./useRealtime";
export { default as useSafeIntervalHook } from "./useSafeInterval";