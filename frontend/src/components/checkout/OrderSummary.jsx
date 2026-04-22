import { ShoppingCart } from "lucide-react";
import { formatPrice } from "../../utils/format";

export default function OrderSummary({
  items = [],
  subtotal = 0,
  discountAmount = 0,
  gstAmount = 0,
  deliveryFee = 0,
  total = 0,
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5 shadow-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Order Summary <ShoppingCart size={16} className="text-gray-400" />
        </h3>
        <span className="text-xs text-gray-500">
          {safeItems.length} item{safeItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ITEMS */}
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
        {safeItems.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            No items in your order
          </p>
        ) : (
          safeItems.map((i, idx) => (
            <div key={i.id || idx} className="flex gap-3">

              {/* IMAGE */}
              <div className="w-14 h-18 rounded-lg overflow-hidden bg-gray-100 border">
                <img
                  src={i.image || "/placeholder.png"}
                  alt={i.title || "Product"}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* DETAILS */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {i.title || "Product"}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Qty: {i.quantity || 1}
                  {i.color && ` • ${i.color}`}
                  {i.size && ` • ${i.size}`}
                </p>

                <p className="text-sm font-semibold mt-1">
                  {formatPrice(i.price || 0)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PRICE BREAKDOWN */}
      <div className="border-t pt-4 space-y-2 text-sm">

        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-500">Tax (GST)</span>
          <span>{formatPrice(gstAmount)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Delivery</span>
          <span className={deliveryFee === 0 ? "text-green-600" : ""}>
            {deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}
          </span>
        </div>

        {/* TOTAL */}
        <div className="flex justify-between pt-3 border-t font-semibold text-base">
          <span>Total</span>
          <span className="text-indigo-600">
            {formatPrice(total)}
          </span>
        </div>
      </div>
    </div>
  );
}