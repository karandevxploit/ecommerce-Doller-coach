import { ShoppingCart } from "lucide-react";
import { formatPrice } from "../../utils/format";

export default function OrderSummary({ items, subtotal, discountAmount, gstAmount, deliveryFee, total }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <h3 className="text-lg font-black text-[#0f172a] uppercase tracking-tighter flex items-center gap-2">
          Order Manifest <ShoppingCart size={18} className="text-gray-300" />
        </h3>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">
          {items.length} Items
        </span>
      </div>

      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
        {items.map((i, idx) => (
          <div key={i.id || idx} className="flex gap-4 items-start group">
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
               <img src={i.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={i.title} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{i.title}</p>
              <p className="text-[10px] text-gray-500 mt-1 font-medium uppercase tracking-wider">
                Qty: {i.quantity} • {i.topSize && i.bottomSize ? `${i.topSize}(T)/${i.bottomSize}(B)` : i.size || "Standard"}
              </p>
              <p className="text-sm font-black text-[#0f172a] mt-1">{formatPrice(i.price)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-50 pt-4 space-y-3">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-gray-500 uppercase tracking-widest">Subtotal</span>
          <span className="text-gray-900">{formatPrice(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs font-bold">
            <span className="text-green-600 uppercase tracking-widest">Discount</span>
            <span className="text-green-600">-{formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs font-medium">
          <span className="text-gray-500 uppercase tracking-widest">GST</span>
          <span className="text-gray-900">{formatPrice(gstAmount)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium">
          <span className="text-gray-500 uppercase tracking-widest">Delivery</span>
          <span className={`font-bold ${deliveryFee === 0 ? "text-green-600" : "text-gray-900"}`}>
            {deliveryFee === 0 ? "COMPLIMENTARY" : formatPrice(deliveryFee)}
          </span>
        </div>
        <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
          <span className="text-sm font-black text-gray-900 uppercase tracking-tighter">Total Due</span>
          <span className="text-2xl font-black text-indigo-600 tracking-tighter">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}
