import { useState, useCallback, useEffect, useRef } from "react";

/**
 * useForm Hook
 * Robust form handling with validation, touched state, and async safety
 */
export const useForm = (initialValues = {}, validate = () => ({})) => {
  const mountedRef = useRef(true);
  const initialValuesRef = useRef(initialValues);

  const [values, setValuesState] = useState(initialValues);
  const [errors, setErrorsState] = useState({});
  const [touched, setTouchedState] = useState({});
  const [isSubmitting, setIsSubmittingState] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  const safeSetValues = useCallback((next) => {
    if (mountedRef.current) setValuesState(next);
  }, []);

  const safeSetErrors = useCallback((next) => {
    if (mountedRef.current) setErrorsState(next);
  }, []);

  const safeSetTouched = useCallback((next) => {
    if (mountedRef.current) setTouchedState(next);
  }, []);

  const safeSetSubmitting = useCallback((next) => {
    if (mountedRef.current) setIsSubmittingState(next);
  }, []);

  const runValidation = useCallback(
    (nextValues) => {
      try {
        const result = validate?.(nextValues);
        return result && typeof result === "object" ? result : {};
      } catch (err) {
        console.error("[useForm] Validation error:", err);
        return {};
      }
    },
    [validate]
  );

  const getInputValue = (target) => {
    const { type, value, checked, files, multiple, options } = target;

    if (type === "checkbox") return checked;
    if (type === "file") return multiple ? Array.from(files || []) : files?.[0] || null;
    if (type === "number") return value === "" ? "" : Number(value);

    if (multiple && options) {
      return Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value);
    }

    return value;
  };

  /* ---------------- HANDLE CHANGE ---------------- */
  const handleChange = useCallback(
    (e) => {
      const target = e?.target;
      if (!target?.name) return;

      const { name } = target;
      const value = getInputValue(target);

      setValuesState((prev) => {
        const updated = { ...prev, [name]: value };
        const validationErrors = runValidation(updated);

        safeSetErrors(validationErrors);

        return updated;
      });
    },
    [runValidation, safeSetErrors]
  );

  /* ---------------- HANDLE BLUR ---------------- */
  const handleBlur = useCallback(
    (e) => {
      const name = e?.target?.name;
      if (!name) return;

      safeSetTouched((prev) => ({ ...prev, [name]: true }));

      const validationErrors = runValidation(values);
      safeSetErrors(validationErrors);
    },
    [values, runValidation, safeSetTouched, safeSetErrors]
  );

  /* ---------------- HANDLE SUBMIT ---------------- */
  const handleSubmit = useCallback(
    async (e, callback) => {
      e?.preventDefault?.();

      const validationErrors = runValidation(values);
      safeSetErrors(validationErrors);

      const allTouched = Object.keys(values || {}).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      );

      safeSetTouched(allTouched);

      if (Object.keys(validationErrors).length > 0) {
        return {
          success: false,
          errors: validationErrors,
        };
      }

      safeSetSubmitting(true);

      try {
        const result =
          typeof callback === "function" ? await callback(values) : undefined;

        return {
          success: true,
          values,
          result,
        };
      } catch (err) {
        console.error("[useForm] Submit error:", err);

        return {
          success: false,
          error: err,
        };
      } finally {
        safeSetSubmitting(false);
      }
    },
    [
      values,
      runValidation,
      safeSetErrors,
      safeSetTouched,
      safeSetSubmitting,
    ]
  );

  /* ---------------- RESET ---------------- */
  const resetForm = useCallback((nextValues) => {
    const resetValues = nextValues || initialValuesRef.current || {};

    safeSetValues(resetValues);
    safeSetErrors({});
    safeSetTouched({});
    safeSetSubmitting(false);
  }, [safeSetValues, safeSetErrors, safeSetTouched, safeSetSubmitting]);

  /* ---------------- SET FIELD VALUE ---------------- */
  const setFieldValue = useCallback(
    (name, value, shouldValidate = true) => {
      if (!name) return;

      setValuesState((prev) => {
        const updated = { ...prev, [name]: value };

        if (shouldValidate) {
          const validationErrors = runValidation(updated);
          safeSetErrors(validationErrors);
        }

        return updated;
      });
    },
    [runValidation, safeSetErrors]
  );

  /* ---------------- SET FIELD TOUCHED ---------------- */
  const setFieldTouched = useCallback((name, value = true) => {
    if (!name) return;

    safeSetTouched((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, [safeSetTouched]);

  return {
    values,
    errors,
    touched,
    isSubmitting,

    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,

    setValues: safeSetValues,
    setErrors: safeSetErrors,
    setTouched: safeSetTouched,
    setFieldValue,
    setFieldTouched,
  };
};

export default useForm;
