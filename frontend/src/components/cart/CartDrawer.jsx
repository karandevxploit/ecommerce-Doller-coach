import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store";
import { formatPrice } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CartDrawer({ isOpen, onClose }) {
  const { cart, removeFromCart, updateQuantity, totalPrice } = useCartStore();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  const handleRemove = (id, size) => {
    removeFromCart(id, size);
    toast.success("Item removed from cart");
  };

  const handleQuantity = (item, change) => {
    const newQty = item.quantity + change;

    if (newQty < 1) return;

    updateQuantity(item.id, item.size, newQty);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* OVERLAY */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* DRAWER */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            {/* HEADER */}
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} />
                <h2 className="text-lg font-bold">Your Cart</h2>
                <span className="text-xs bg-gray-100 px-2 rounded-full">
                  {cart.length}
                </span>
              </div>

              <button onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* ITEMS */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <ShoppingBag size={40} />
                  <p>Your cart is empty</p>
                  <span className="text-xs">
                    Add items to get started
                  </span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={`${item.id}-${item.size}`} className="flex gap-3">

                    {/* IMAGE */}
                    <img
                      src={item.image || "/placeholder.png"}
                      alt={item.title}
                      className="h-20 w-16 object-cover rounded"
                    />

                    {/* DETAILS */}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="text-sm font-medium">
                          {item.title}
                        </h3>

                        <button
                          onClick={() => handleRemove(item.id, item.size)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="text-xs text-gray-400">
                        Size: {item.size || "Standard"}
                      </p>

                      {/* QUANTITY */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex border rounded">
                          <button
                            onClick={() => handleQuantity(item, -1)}
                            className="px-2"
                          >
                            -
                          </button>

                          <span className="px-3 text-sm">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() => handleQuantity(item, 1)}
                            className="px-2"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-sm font-semibold">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* FOOTER */}
            {cart.length > 0 && (
              <div className="p-5 border-t bg-gray-50">
                <div className="flex justify-between mb-3">
                  <span className="text-sm text-gray-500">
                    Subtotal
                  </span>
                  <span className="font-bold">
                    {formatPrice(totalPrice)}
                  </span>
                </div>

                <button
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