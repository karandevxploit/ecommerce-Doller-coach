export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const validatePhone = (phone) => {
  return /^\d{10}$/.test(phone);
};

export const validatePincode = (pincode) => {
  return /^\d{6}$/.test(pincode);
};

export const loginValidator = (values) => {
  const errors = {};
  if (!values.email) errors.email = "Email is required";
  else if (!validateEmail(values.email)) errors.email = "Invalid email format";
  
  if (!values.password) errors.password = "Password is required";
  else if (values.password.length < 6) errors.password = "Min 6 characters required";
  
  return errors;
};

export const registerValidator = (values) => {
  const errors = loginValidator(values);
  if (!values.name) errors.name = "Full name is required";
  if (!values.phone) errors.phone = "Phone number is required";
  return errors;
};

export const addressValidator = (values) => {
  const errors = {};
  if (!values.name) errors.name = "Receiver name required";
  if (!values.phone) errors.phone = "Phone number required";
  else if (!validatePhone(values.phone)) errors.phone = "Invalid 10-digit phone";
  
  if (!values.addressLine1 && !values.address) errors.address = "Street address required";
  if (!values.city) errors.city = "City required";
  if (!values.state) errors.state = "State required";
  if (!values.pincode) errors.pincode = "Pincode required";
  else if (!validatePincode(values.pincode)) errors.pincode = "Invalid 6-digit pincode";
  
  return errors;
};

export const checkoutValidator = (values) => {
  const errors = {};
  if (!values.selectedAddress) errors.selectedAddress = "Please select a shipping address";
  if (!values.paymentMethod) errors.paymentMethod = "Please select a payment method";
  return errors;
};
