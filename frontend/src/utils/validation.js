/* =========================================================
   BASE HELPERS
========================================================= */
const isEmpty = (val) =>
  val === undefined ||
  val === null ||
  String(val).trim() === "";

const clean = (val) => String(val || "").trim();

const digitsOnly = (val) => clean(val).replace(/\D/g, "");

/* =========================================================
   FIELD VALIDATORS
========================================================= */
export const validateEmail = (email) => {
  const value = clean(email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const validatePhone = (phone) => {
  const value = digitsOnly(phone);
  return /^\d{10}$/.test(value);
};

export const validatePincode = (pincode) => {
  const value = digitsOnly(pincode);
  return /^\d{6}$/.test(value);
};

export const validatePassword = (password, minLength = 6) => {
  return clean(password).length >= minLength;
};

export const validateRequired = (value) => !isEmpty(value);

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
  } else if (!validatePassword(values.password)) {
    errors.password = "Password must be at least 6 characters";
  }

  return errors;
};

/* =========================================================
   REGISTER VALIDATION
========================================================= */
export const registerValidator = (values = {}) => {
  const errors = {};

  if (isEmpty(values.name)) {
    errors.name = "Full name is required";
  }

  if (isEmpty(values.email)) {
    errors.email = "Email is required";
  } else if (!validateEmail(values.email)) {
    errors.email = "Enter a valid email address";
  }

  if (isEmpty(values.phone)) {
    errors.phone = "Phone number is required";
  } else if (!validatePhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number";
  }

  if (isEmpty(values.password)) {
    errors.password = "Password is required";
  } else if (!validatePassword(values.password)) {
    errors.password = "Password must be at least 6 characters";
  }

  return errors;
};

/* =========================================================
   ADDRESS VALIDATION
========================================================= */
export const addressValidator = (values = {}) => {
  const errors = {};

  const name = values.name || values.fullName;
  const address = values.addressLine1 || values.address || values.street;

  if (isEmpty(name)) {
    errors.name = "Receiver name is required";
  }

  if (isEmpty(values.phone)) {
    errors.phone = "Phone number is required";
  } else if (!validatePhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number";
  }

  if (isEmpty(address)) {
    errors.address = "Address is required";
  } else if (clean(address).length < 5) {
    errors.address = "Address is too short";
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
  } else {
    const addressErrors = addressValidator(values.selectedAddress);

    if (Object.keys(addressErrors).length > 0) {
      errors.selectedAddress = "Complete your delivery address";
    }
  }

  const allowedPaymentMethods = ["UPI", "CARD", "NETBANKING", "COD", "RAZORPAY"];

  if (!values.paymentMethod) {
    errors.paymentMethod = "Select a payment method";
  } else if (!allowedPaymentMethods.includes(values.paymentMethod)) {
    errors.paymentMethod = "Select a valid payment method";
  }

  return errors;
};

/* =========================================================
   CENTRAL RULE EXPORT
========================================================= */
export const validationRules = {
  required: validateRequired,
  email: validateEmail,
  phone: validatePhone,
  pincode: validatePincode,
  password: validatePassword,
};

export default validationRules;
