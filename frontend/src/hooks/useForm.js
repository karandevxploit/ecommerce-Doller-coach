import { useState, useCallback } from "react";

/**
 * useForm Hook
 * Robust form handling with validation, touched state, and async safety
 */
export const useForm = (initialValues = {}, validate = () => ({})) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- HANDLE CHANGE ---------------- */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;

    setValues((prev) => {
      const updated = { ...prev, [name]: val };

      // live validation (optional)
      const validationErrors = validate(updated);
      setErrors(validationErrors);

      return updated;
    });
  }, [validate]);

  /* ---------------- HANDLE BLUR ---------------- */
  const handleBlur = useCallback((e) => {
    const { name } = e.target;

    setTouched((prev) => ({ ...prev, [name]: true }));

    const validationErrors = validate(values);
    setErrors(validationErrors);
  }, [values, validate]);

  /* ---------------- HANDLE SUBMIT ---------------- */
  const handleSubmit = useCallback(
    async (e, callback) => {
      e?.preventDefault?.();

      const validationErrors = validate(values);
      setErrors(validationErrors);

      // mark all fields touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      );
      setTouched(allTouched);

      if (Object.keys(validationErrors).length > 0) return;

      setIsSubmitting(true);

      try {
        await callback?.(values);
      } catch (err) {
        console.error("[useForm] Submit error:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate]
  );

  /* ---------------- RESET ---------------- */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  /* ---------------- SET FIELD VALUE ---------------- */
  const setFieldValue = useCallback((name, value) => {
    setValues((prev) => {
      const updated = { ...prev, [name]: value };
      const validationErrors = validate(updated);
      setErrors(validationErrors);
      return updated;
    });
  }, [validate]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValues,
    setErrors,
    setFieldValue
  };
};