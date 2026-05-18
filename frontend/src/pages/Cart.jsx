import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore, useAuthStore } from "../store";
import SafeImage from "../components/ui/SafeImage";
import { safeApi } from "../api/client";
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

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getProductList = (response) => {
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.products)) return data.data.products;

  return [];
};

export default function Cart() {
  const navigate = useNavigate();

  const { isAuthenticated, openAuthModal } = useAuthStore();

  const {
    cart = [],
    updateQuantity,
    removeFromCart,
    totalPrice = 0,
    fetchCart,
    isLoading,
  } = useCartStore();

  const [suggestions, setSuggestions] = useState([]);

  const safeCart = useMemo(() => {
    return Array.isArray(cart)
      ? cart.filter((item) => item && typeof item === "object")
      : [];
  }, [cart]);

  const cartCount = safeCart.length;

  const computedSubtotal = useMemo(() => {
    if (safeNumber(totalPrice) > 0) return safeNumber(totalPrice);

    return safeCart.reduce((sum, item) => {
      const price = safeNumber(item.price);
      const quantity = Math.max(1, safeNumber(item.quantity, 1));
      return sum + price * quantity;
    }, 0);
  }, [safeCart, totalPrice]);

  useEffect(() => {
    if (isAuthenticated && typeof fetchCart === "function") {
      fetchCart();
    }
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    let mounted = true;

    const fetchSuggestions = async () => {
      if (!safeCart.length) {
        setSuggestions([]);
        return;
      }

      const firstCategory =
        safeCart[0]?.category?.main ||
        safeCart[0]?.category?.name ||
        safeCart[0]?.category ||
        "";

      try {
        const res = await safeApi.get(
          `/products?category=${encodeURIComponent(firstCategory)}&limit=8`
        );

        if (res?.success === false) {
          if (mounted) setSuggestions([]);
          return;
        }

        const mapped = getProductList(res)
          .map(mapProduct)
          .filter(Boolean);

        const cartIds = new Set(
          safeCart
            .map((item) => String(item.id || item._id || item.productId || ""))
            .filter(Boolean)
        );

        const filtered = mapped
          .filter((product) => {
            const id = String(product.id || product._id || "");
            return id && !cartIds.has(id);
          })
          .slice(0, 4);

        if (mounted) {
          setSuggestions(filtered);
        }
      } catch {
        if (mounted) {
          setSuggestions([]);
        }
      }
    };

    fetchSuggestions();

    return () => {
      mounted = false;
    };
  }, [safeCart]);

  const handleLogin = () => {
    if (typeof openAuthModal === "function") {
      openAuthModal();
      return;
    }

    navigate("/login");
  };

  const handleRemove = async (item) => {
    const id = item?.id || item?._id || item?.productId;
    if (!id) return;

    try {
      await removeFromCart?.(
        id,
        item.size || item.variantSize || "",
        item.color || "",
        item.topSize || "",
        item.bottomSize || "",
        item.variantIdx
      );
    } catch {
      // Store usually handles toast/error. Keep UI stable.
    }
  };

  const handleQuantityChange = async (item, nextQuantity) => {
    const id = item?.id || item?._id || item?.productId;
    if (!id) return;

    const safeQuantity = Math.max(1, safeNumber(nextQuantity, 1));

    try {
      await updateQuantity?.(
        id,
        item.size || item.variantSize || "",
        safeQuantity,
        item.color || "",
        item.topSize || "",
        item.bottomSize || "",
        item.variantIdx
      );
    } catch {
      // Store usually handles toast/error. Keep UI stable.
    }
  };

  /* ---------------- AUTH GUARD ---------------- */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-slate-50">
        <ShieldCheck size={40} className="text-slate-400 mb-4" />

        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">
          Please login to view your cart
        </h2>

        <p className="text-slate-500 mb-6">
          Your saved items will appear here after login
        </p>

        <div className="flex gap-3">
          <Button onClick={handleLogin}>Login</Button>

          <Button variant="outline" onClick={() => navigate("/register")}>
            Create Account
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------- LOADING ---------------- */
  if (isLoading && cartCount === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-gray-200 border-t-black animate-spin rounded-full" />
      </div>
    );
  }

  /* ---------------- EMPTY ---------------- */
  if (!cartCount) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-slate-50">
        <ShoppingBag size={40} className="text-slate-300 mb-4" />

        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
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

  const shipping = 40;
  const finalTotal = computedSubtotal + shipping;

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <div className="page-shell max-w-6xl">
        {/* HEADER */}
        <div className="surface p-4 md:p-5 flex justify-between items-center mb-5 gap-4">
          <h1 className="page-title">
            Shopping Cart ({cartCount})
          </h1>

          <Button variant="outline" onClick={() => navigate("/collection")}>
            Continue Shopping
          </Button>
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-7 space-y-4">
            <AnimatePresence>
              {safeCart.map((item, index) => {
                const id = item.id || item._id || item.productId;
                const quantity = Math.max(1, safeNumber(item.quantity, 1));
                const price = safeNumber(item.price);
                const size = item.size || item.topSize || item.variantSize || "";
                const title = item.title || item.name || "Product";

                return (
                  <motion.div
                    key={item.cartItemId || `${id || "cart-item"}-${size}-${index}`}
                    layout
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="surface flex gap-3 md:gap-4 p-3 md:p-4"
                  >
                    <Link to={id ? `/product/${id}` : "#"} className="w-20 h-24 md:w-24 md:h-28 shrink-0">
                      <SafeImage
                        src={item.image || item.primaryImage}
                        alt={title}
                        wrapperClassName="w-full h-full rounded-lg"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <Link
                          to={id ? `/product/${id}` : "#"}
                          className="font-black text-sm uppercase tracking-tight text-slate-900 hover:underline line-clamp-2"
                        >
                          {title}
                        </Link>

                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() => handleRemove(item)}
                          className="text-red-500 hover:text-red-700 shrink-0 rounded-lg p-1 hover:bg-red-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {size && (
                        <p className="text-xs font-bold text-slate-500 mt-1">
                          {size}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-4">
                        {/* Qty */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item, quantity - 1)
                            }
                            disabled={quantity <= 1}
                            className="icon-button !h-8 !w-8 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>

                          <span className="text-sm font-black min-w-[20px] text-center">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item, quantity + 1)
                            }
                            className="icon-button !h-8 !w-8"
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        {/* Price */}
                        <p className="font-black">
                          {formatPrice(price * quantity)}
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
                <h3 className="text-sm font-black uppercase tracking-widest mb-4">
                  You may also like
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {suggestions.map((product, index) => {
                    const id = product.id || product._id;

                    return (
                      <Link
                        key={id || `suggestion-${index}`}
                        to={id ? `/product/${id}` : "#"}
                        className="surface overflow-hidden hover:shadow-md transition"
                      >
                        <SafeImage
                          src={product.image || product.images?.[0]}
                          alt={product.title || "Product"}
                          wrapperClassName="h-40 w-full"
                          className="h-40 w-full object-cover"
                        />

                        <div className="p-2 text-sm">
                          <p className="truncate">
                            {product.title || "Product"}
                          </p>

                          <p className="font-semibold">
                            {formatPrice(product.price || 0)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5">
            <div className="surface p-5 sticky top-20 space-y-4">
              <h3 className="font-black text-lg uppercase tracking-tight">Order Summary</h3>

              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(computedSubtotal)}</span>
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
