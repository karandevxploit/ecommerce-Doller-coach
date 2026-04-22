import { Smartphone, CreditCard, Building2, Banknote } from "lucide-react";

export default function PaymentMethods({ selected, onSelect }) {
  const isMobile = /Android|iPhone/i.test(navigator.userAgent);

  const methods = [
    {
      id: "UPI",
      name: "UPI / QR",
      desc: isMobile
        ? "Pay instantly with GPay, PhonePe, Paytm"
        : "Scan QR using any UPI app",
      icon: <Smartphone size={20} />,
      badges: ["GPay", "PhonePe", "Paytm"],
    },
    {
      id: "CARD",
      name: "Card",
      desc: "Debit or credit card",
      icon: <CreditCard size={20} />,
      badges: ["Visa", "Mastercard", "RuPay"],
    },
    {
      id: "NETBANKING",
      name: "Net Banking",
      desc: "All major banks supported",
      icon: <Building2 size={20} />,
      badges: [],
    },
    {
      id: "COD",
      name: "Cash on Delivery",
      desc: "Pay when you receive",
      icon: <Banknote size={20} />,
      badges: [],
      warning: "₹50 extra charge may apply",
    },
  ];

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5 shadow-sm">

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black text-white text-xs font-bold">
          2
        </span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Select payment method
          </h2>
          <p className="text-xs text-gray-400">
            Choose how you want to pay
          </p>
        </div>
      </div>

      {/* METHODS */}
      <div className="grid grid-cols-2 gap-4">
        {methods.map((m) => {
          const isActive = selected === m.id;

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-pressed={isActive}
              className={`flex flex-col items-center gap-2 p-4 border rounded-xl transition ${isActive
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
                }`}
            >
              {/* ICON */}
              <div className={isActive ? "text-black" : "text-gray-400"}>
                {m.icon}
              </div>

              {/* NAME */}
              <span className="text-sm font-medium text-gray-900">
                {m.name}
              </span>

              {/* DESC */}
              <span className="text-[11px] text-gray-400 text-center">
                {m.desc}
              </span>

              {/* BADGES (PAYMENT ICONS TEXT STYLE) */}
              {m.badges?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {m.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[9px] px-2 py-[2px] bg-gray-100 rounded-full text-gray-500"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {/* COD WARNING */}
              {m.warning && (
                <span className="text-[10px] text-orange-500 text-center mt-1">
                  {m.warning}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* EXTRA INFO BASED ON SELECTION */}
      {selected === "UPI" && (
        <div className="text-xs text-green-600 bg-green-50 p-3 rounded-lg text-center">
          Fast & secure payment. No extra charges.
        </div>
      )}

      {selected === "COD" && (
        <div className="text-xs text-orange-600 bg-orange-50 p-3 rounded-lg text-center">
          Cash on Delivery may include additional handling charges.
        </div>
      )}
    </div>
  );
}