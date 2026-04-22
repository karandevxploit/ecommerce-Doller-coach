import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore, useAuthStore } from "../store";
import SafeImage from "../components/ui/SafeImage";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import {
  Trash2,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Minus,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "../utils/format";
import Button from "../components/ui/Button";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    cart = [],
    updateQuantity,
    removeFromCart,
    totalPrice = 0,
    fetchCart,
    isLoading,
  } = useCartStore();

  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (isAuthenticated) fetchCart();
  }, [isAuthenticated]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!cart?.length) return;

      try {
        const res = await api.get(
          `/products?category=${cart[0]?.category || ""}`
        );

        const data =
          res?.data || res?.products || (Array.isArray(res) ? res : []);

        const mapped = data.map(mapProduct);

        setSuggestions(
          mapped
            .filter(
              (p) =>
                !cart.some(
                  (i) => (i.id || i._id) === (p.id || p._id)
                )
            )
            .slice(0, 4)
        );
      } catch {
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [cart]);

  /* ---------------- AUTH GUARD ---------------- */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-white">
        <ShieldCheck size={40} className="text-slate-400 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Please login to view your cart
        </h2>
        <p className="text-slate-500 mb-6">
          Your saved items will appear here after login
        </p>

        <div className="flex gap-3">
          <Button onClick={() => navigate("/login")}>Login</Button>
          <Button variant="outline" onClick={() => navigate("/register")}>
            Create Account
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- LOADING ---------------- */
  if (isLoading && cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-gray-200 border-t-black animate-spin rounded-full" />
      </div>
    );
  }

  /* ---------------- EMPTY ---------------- */
  if (!cart.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <ShoppingBag size={40} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">
          Your cart is empty
        </h2>
        <p className="text-slate-500 mt-2 mb-6">
          Browse products and add them to your cart
        </p>

        <Button onClick={() => navigate("/collection")}>
          Start Shopping <ArrowRight size={16} />
        </Button>
      </div>
    );
  }

  const shipping = totalPrice > 500 ? 0 : 40;
  const finalTotal = totalPrice + shipping;

  return (
    <div className="bg-white min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Shopping Cart ({cart.length})
          </h1>

          <Button variant="outline" onClick={() => navigate("/collection")}>
            Continue Shopping
          </Button>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          {/* LEFT */}
          <div className="lg:col-span-7 space-y-4">
            <AnimatePresence>
              {cart.map((item) => {
                const id = item.id || item._id;

                return (
                  <motion.div
                    key={item.cartItemId || id}
                    layout
                    className="flex gap-4 border rounded-xl p-4"
                  >
                    <Link to={`/product/${id}`} className="w-24 h-28">
                      <SafeImage
                        src={item.image}
                        alt={item.title || "Product"}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </Link>

                    <div className="flex-1">
                      <div className="flex justify-between">
                        <Link
                          to={`/product/${id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {item.title || "Product"}
                        </Link>

                        <button
                          aria-label="Remove item"
                          onClick={() =>
                            removeFromCart(
                              id,
                              item.size || item.topSize
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <p className="text-sm text-slate-500 mt-1">
                        {item.size || item.topSize || ""}
                      </p>

                      <div className="flex items-center justify-between mt-4">
                        {/* Qty */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(
                                id,
                                item.size || item.topSize,
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            className="p-1 border rounded"
                          >
                            <Minus size={14} />
                          </button>

                          <span className="text-sm font-medium">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              updateQuantity(
                                id,
                                item.size || item.topSize,
                                item.quantity + 1
                              )
                            }
                            className="p-1 border rounded"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Price */}
                        <p className="font-semibold">
                          {formatPrice(
                            (item.price || 0) * item.quantity
                          )}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-10">
                <h3 className="font-semibold mb-4">
                  You may also like
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {suggestions.map((p) => (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      className="border rounded-lg overflow-hidden"
                    >
                      <SafeImage
                        src={p.image}
                        alt={p.title}
                        className="h-40 w-full object-cover"
                      />
                      <div className="p-2 text-sm">
                        <p className="truncate">{p.title}</p>
                        <p className="font-semibold">
                          {formatPrice(p.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5">
            <div className="border rounded-xl p-6 sticky top-20 space-y-4">
              <h3 className="font-semibold text-lg">Order Summary</h3>

              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>

              <div className="border-t pt-4 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(finalTotal)}</span>
              </div>

              <Button
                className="w-full"
                onClick={() => navigate("/checkout")}
              >
                Proceed to Checkout <ArrowRight size={16} />
              </Button>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Truck size={14} /> Fast delivery available
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}