import { useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { formatPrice } from "../../utils/format";
import SafeImage from "../ui/SafeImage";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getItemKey = (item, index) => {
  return [
    item?.cartItemId || item?.id || item?._id || `item-${index}`,
    item?.size || "",
    item?.topSize || "",
    item?.bottomSize || "",
  ].join("-");
};

export default function OrderSummary({
  items = [],
  subtotal = 0,
  discountAmount = 0,
  gstAmount = 0,
  deliveryFee = 0,
  codFee = 0,
  total = 0,
}) {
  const safeItems = useMemo(() => {
    return Array.isArray(items) ? items.filter(Boolean) : [];
  }, [items]);

  const computedSubtotal = useMemo(() => {
    return safeItems.reduce((sum, item) => {
      const quantity = Math.max(safeNumber(item?.quantity, 1), 1);
      return sum + safeNumber(item?.price) * quantity;
    }, 0);
  }, [safeItems]);

  const safeSubtotal = safeNumber(subtotal, computedSubtotal);
  const safeDiscount = Math.max(safeNumber(discountAmount), 0);
  const safeGst = Math.max(safeNumber(gstAmount), 0);
  const safeDelivery = Math.max(safeNumber(deliveryFee), 0);
  const safeCodFee = Math.max(safeNumber(codFee), 0);

  const computedTotal = Math.max(
    safeSubtotal - safeDiscount + safeGst + safeDelivery + safeCodFee,
    0
  );

  const safeTotal = safeNumber(total, computedTotal);

  return (
    <div className="bg-white border rounded-xl p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Order Summary <ShoppingCart size={16} className="text-gray-400" />
        </h3>
        <span className="text-xs text-gray-500">
          {safeItems.length} item{safeItems.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
        {safeItems.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            No items in your order
          </p>
        ) : (
          safeItems.map((item, index) => {
            const quantity = Math.max(safeNumber(item?.quantity, 1), 1);
            const sizeLabel =
              item?.topSize && item?.bottomSize
                ? `${item.topSize} / ${item.bottomSize}`
                : item?.size || "";

            return (
              <div key={getItemKey(item, index)} className="flex gap-3">
                  <div className="w-14 h-18 rounded-lg overflow-hidden bg-gray-100 border">
                    <SafeImage
                    src={item?.image}
                    alt={item?.title || "Product"}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item?.title || "Product"}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Qty: {quantity}
                    {item?.color && ` • ${item.color}`}
                    {sizeLabel && ` • ${sizeLabel}`}
                  </p>

                  <p className="text-sm font-semibold mt-1">
                    {formatPrice(safeNumber(item?.price))}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatPrice(safeSubtotal)}</span>
        </div>

        {safeDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(safeDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-500">GST (18%)</span>
          <span>{formatPrice(safeGst)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Delivery</span>
          <span>{formatPrice(safeDelivery)}</span>
        </div>

        {safeCodFee > 0 && (
          <div className="flex justify-between text-indigo-600">
            <span>COD Collection Fee</span>
            <span>{formatPrice(safeCodFee)}</span>
          </div>
        )}

        <div className="flex justify-between pt-3 border-t font-semibold text-base">
          <span>Total</span>
          <span className="text-indigo-600">{formatPrice(safeTotal)}</span>
        </div>
      </div>
    </div>
  );
}
