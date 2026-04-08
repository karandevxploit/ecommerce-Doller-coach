import React from "react";

const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const styles = {
    primary: "bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md hover:bg-indigo-700 hover:shadow-lg",
    outline: "border border-indigo-600 text-indigo-600 px-5 py-2.5 rounded-xl hover:bg-indigo-600 hover:text-white",
    secondary: "bg-gray-100 text-gray-800 px-5 py-2.5 rounded-xl hover:bg-gray-200",
    danger: "bg-red-500 text-white px-5 py-2.5 rounded-xl hover:bg-red-600",
    icon: "p-2 rounded-lg text-gray-700 hover:bg-gray-100",
    quantity: "px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
  };

  return (
    <button className={`${styles[variant]} focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 flex items-center justify-center gap-2 ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
