/* =========================================================
   BASE HELPERS
========================================================= */
const isEmpty = (val) =>
  val === undefined ||
  val === null ||
  String(val).trim() === "";

const clean = (val) =>
  String(val || "").trim();

/* =========================================================
   FIELD VALIDATORS
========================================================= */
export const validateEmail = (email) => {
  const value = clean(email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const validatePhone = (phone) => {
  const value = clean(phone);
  return /^\d{10}$/.test(value);
};

export const validatePincode = (pincode) => {
  const value = clean(pincode);
  return /^\d{6}$/.test(value);
};

/* =========================================================
   LOGIN VALIDATION
========================================================= */
export const loginValidator = (values = {}) => {
  const errors = {};

  if (isEmpty(values.email)) {
    errors.email = "Email is required";
  } else if (!validateEmail(values.email)) {
    errors.email = "Enter a valid email address";
  }

  if (isEmpty(values.password)) {
    errors.password = "Password is required";
  } else if (clean(values.password).length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return errors;
};

/* =========================================================
   REGISTER VALIDATION
========================================================= */
export const registerValidator = (values = {}) => {
  const errors = loginValidator(values);

  if (isEmpty(values.name)) {
    errors.name = "Full name is required";
  }

  if (isEmpty(values.phone)) {
    errors.phone = "Phone number is required";
  } else if (!validatePhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number";
  }

  return errors;
};

/* =========================================================
   ADDRESS VALIDATION
========================================================= */
export const addressValidator = (values = {}) => {
  const errors = {};

  if (isEmpty(values.name)) {
    errors.name = "Receiver name is required";
  }

  if (isEmpty(values.phone)) {
    errors.phone = "Phone number is required";
  } else if (!validatePhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number";
  }

  const address = values.addressLine1 || values.address;

  if (isEmpty(address)) {
    errors.address = "Address is required";
  }

  if (isEmpty(values.city)) {
    errors.city = "City is required";
  }

  if (isEmpty(values.state)) {
    errors.state = "State is required";
  }

  if (isEmpty(values.pincode)) {
    errors.pincode = "Pincode is required";
  } else if (!validatePincode(values.pincode)) {
    errors.pincode = "Enter a valid 6-digit pincode";
  }

  return errors;
};

/* =========================================================
   CHECKOUT VALIDATION
========================================================= */
export const checkoutValidator = (values = {}) => {
  const errors = {};

  if (!values.selectedAddress) {
    errors.selectedAddress = "Select a delivery address";
  }

  if (!values.paymentMethod) {
    errors.paymentMethod = "Select a payment method";
  }

  return errors;
};