import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store";
import { formatPrice } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import SafeImage from "@/components/ui/SafeImage";

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCartKey = (item, index) => {
  return [
    item?.cartItemId || item?.id || `item-${index}`,
    item?.size || "",
    item?.topSize || "",
    item?.bottomSize || "",
  ].join("-");
};

export default function CartDrawer({ isOpen, onClose }) {
  const { cart = [], removeFromCart, updateQuantity, totalPrice } = useCartStore();
  const navigate = useNavigate();

  const safeCart = useMemo(() => {
    return Array.isArray(cart) ? cart.filter(Boolean) : [];
  }, [cart]);

  const subtotal = useMemo(() => {
    const computed = safeCart.reduce((sum, item) => {
      return sum + safeNumber(item?.price) * Math.max(safeNumber(item?.quantity, 1), 1);
    }, 0);

    return safeNumber(totalPrice, computed);
  }, [safeCart, totalPrice]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCheckout = () => {
    if (!safeCart.length) {
      toast.error("Your cart is empty");
      return;
    }

    onClose?.();
    navigate("/checkout");
  };

  const handleRemove = (item) => {
    if (!item?.id) return;

    removeFromCart(
      item.id,
      item.size || "",
      item.color || "",
      item.topSize || "",
      item.bottomSize || "",
      item.variantIdx
    );
    toast.success("Item removed from cart");
  };

  const handleQuantity = (item, change) => {
    if (!item?.id) return;

    const currentQty = Math.max(safeNumber(item.quantity, 1), 1);
    const nextQty = currentQty + change;

    if (nextQty < 1) return;

    updateQuantity(
      item.id,
      item.size || "",
      nextQty,
      item.color || "",
      item.topSize || "",
      item.bottomSize || "",
      item.variantIdx
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} />
                <h2 className="text-lg font-bold">Your Cart</h2>
                <span className="text-xs bg-gray-100 px-2 rounded-full">
                  {safeCart.length}
                </span>
              </div>

              <button type="button" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {safeCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <ShoppingBag size={40} />
                  <p>Your cart is empty</p>
                  <span className="text-xs">Add items to get started</span>
                </div>
              ) : (
                safeCart.map((item, index) => {
                  const quantity = Math.max(safeNumber(item.quantity, 1), 1);
                  const lineTotal = safeNumber(item.price) * quantity;

                  return (
                    <div key={getCartKey(item, index)} className="flex gap-3">
                      <SafeImage
                        src={item.image}
                        alt={item.title || "Cart item"}
                        wrapperClassName="h-20 w-16 rounded"
                        className="h-full w-full object-cover"
                      />

                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h3 className="text-sm font-medium">
                            {item.title || "Product"}
                          </h3>

                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <p className="text-xs text-gray-400">
                          Size:{" "}
                          {item.topSize && item.bottomSize
                            ? `${item.topSize} / ${item.bottomSize}`
                            : item.size || "Standard"}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex border rounded">
                            <button
                              type="button"
                              onClick={() => handleQuantity(item, -1)}
                              className="px-2"
                            >
                              -
                            </button>

                            <span className="px-3 text-sm">{quantity}</span>

                            <button
                              type="button"
                              onClick={() => handleQuantity(item, 1)}
                              className="px-2"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-sm font-semibold">
                            {formatPrice(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {safeCart.length > 0 && (
              <div className="p-5 border-t bg-gray-50">
                <div className="flex justify-between mb-3">
                  <span className="text-sm text-gray-500">Subtotal</span>
                  <span className="font-bold">{formatPrice(subtotal)}</span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full bg-black text-white py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  Proceed to Checkout <ArrowRight size={16} />
                </button>

                <p className="text-xs text-gray-400 text-center mt-2">
                  Safe & secure checkout
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
