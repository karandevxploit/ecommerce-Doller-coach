import { Smartphone, CreditCard, Building2, Banknote } from "lucide-react";

export default function PaymentMethods({ selected, onSelect }) {
  const methods = [
    { id: "UPI", name: "UPI / QR", icon: <Smartphone size={20} /> },
    { id: "CARD", name: "Card / Debit", icon: <CreditCard size={20} /> },
    { id: "NETBANKING", name: "Net Banking", icon: <Building2 size={20} /> },
    { id: "COD", name: "Cash on Delivery", icon: <Banknote size={20} /> },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 lg:p-8 space-y-6 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0f172a] text-white text-xs font-black">02</span>
        <h2 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter">Payment Option</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={`flex flex-col items-center gap-3 p-5 border-2 rounded-2xl transition-all duration-300 ${
              selected === m.id
              ? "border-[#0f172a] bg-gray-50 shadow-sm"
              : "border-gray-50 hover:border-gray-200"
            }`}
          >
            <div className={`${selected === m.id ? "text-[#0f172a]" : "text-gray-300"} transition-colors`}>
              {m.icon}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${selected === m.id ? "text-[#0f172a]" : "text-gray-400"}`}>
              {m.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
