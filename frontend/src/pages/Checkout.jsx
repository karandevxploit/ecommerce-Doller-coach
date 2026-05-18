import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCartStore, useAuthStore } from "../store";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Truck,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import SmartCheckoutAddress from "../components/checkout/SmartCheckoutAddress";
import OrderSummary from "../components/checkout/OrderSummary";
import PaymentMethods from "../components/checkout/PaymentMethods";
import CouponSection from "../components/checkout/CouponSection";
import { useForm } from "../hooks/useForm";
import { checkoutValidator } from "../utils/validation";

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalize = (value) => (typeof value === "string" ? value.trim() : value);
const GST_PERCENT = 18;
const DELIVERY_FEE = 40;
const COD_FEE = 50;

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const buyNowProduct = location.state?.buyNowProduct;

  const { isAuthenticated, isInitialized } = useAuthStore();
  const { cart = [], fetchCart, isLoading: cartLoading } = useCartStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const { values, setValues } = useForm(
    { selectedAddress: null, paymentMethod: "UPI" },
    checkoutValidator
  );

  const items = useMemo(() => {
    const source = buyNowProduct ? [buyNowProduct] : cart;
    return Array.isArray(source)
      ? source.filter((item) => item && typeof item === "object")
      : [];
  }, [buyNowProduct, cart]);

  const charges = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const price = safeNumber(item.price);
      const quantity = Math.max(1, safeNumber(item.quantity, 1));
      return acc + price * quantity;
    }, 0);

    const tax = Math.round(subtotal * (GST_PERCENT / 100));
    const delivery = DELIVERY_FEE;
    const codFee = values.paymentMethod === "COD" ? COD_FEE : 0;
    const safeDiscount = Math.min(safeNumber(discount), subtotal);
    const total = Math.max(0, subtotal + tax + delivery + codFee - safeDiscount);

    return {
      subtotal,
      tax,
      delivery,
      discount: safeDiscount,
      codFee,
      gstPercent: GST_PERCENT,
      total,
    };
  }, [items, values.paymentMethod, discount]);

  /* ---------------- DATA FETCHING ---------------- */
  useEffect(() => {
    if (
      isInitialized &&
      isAuthenticated &&
      !buyNowProduct &&
      cart.length === 0 &&
      typeof fetchCart === "function"
    ) {
      fetchCart();
    }
  }, [
    isInitialized,
    isAuthenticated,
    buyNowProduct,
    cart.length,
    fetchCart,
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("checkoutAddress");
      if (!saved) return;

      const address = JSON.parse(saved);
      if (address) {
        setValues((prev) => ({ ...prev, selectedAddress: address }));
      }
    } catch {
      localStorage.removeItem("checkoutAddress");
    }
  }, [setValues]);

  /* ---------------- GUARDS ---------------- */
  useEffect(() => {
    if (!isInitialized || cartLoading) return undefined;

    if (!isAuthenticated) {
      navigate("/login", { replace: true, state: { from: location } });
      return undefined;
    }

    if (items.length === 0) {
      const timer = setTimeout(() => {
        navigate("/cart", { replace: true });
      }, 500);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [
    isInitialized,
    cartLoading,
    isAuthenticated,
    items.length,
    navigate,
    location,
  ]);

  /* ---------------- HANDLERS ---------------- */
  const isAddressValid = useCallback((address) => {
    if (!address) return false;

    const name = normalize(address.name || address.fullName);
    const phone = String(address.phone || "");
    const street = normalize(address.addressLine1 || address.address);
    const city = normalize(address.city);
    const state = normalize(address.state);
    const pincode = String(address.pincode || "");

    return Boolean(
      name &&
      phone.length >= 10 &&
      street &&
      city &&
      state &&
      pincode.length === 6
    );
  }, []);

  const handleAddressComplete = useCallback(
    (address) => {
      setValues((prev) => {
        const prevAddress = JSON.stringify(prev.selectedAddress || null);
        const nextAddress = JSON.stringify(address || null);

        if (prevAddress === nextAddress) return prev;

        try {
          if (address) {
            localStorage.setItem("checkoutAddress", JSON.stringify(address));
          }
        } catch {
          // Ignore storage errors.
        }

        return { ...prev, selectedAddress: address };
      });
    },
    [setValues]
  );

  const handlePaymentSelect = useCallback(
    (method) => {
      setValues((prev) => ({ ...prev, paymentMethod: method }));
    },
    [setValues]
  );

  /* ---------------- COUPON ---------------- */
  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return toast.error("Please enter a coupon code");

    setCouponLoading(true);

    try {
      const endpoint = ENDPOINTS?.COUPONS?.APPLY || "/coupons/apply";

      const res = await api.post(endpoint, {
        code,
        cartTotal: charges.subtotal,
        subtotal: charges.subtotal,
      });

      const data = res?.data ?? res;
      const payload = data?.data ?? data;

      const success =
        data?.success === true ||
        payload?.success === true ||
        Boolean(payload?.discount || payload?.discountAmount);

      if (!success) {
        setDiscount(0);
        setAppliedCoupon(null);
        toast.error(payload?.message || data?.message || "Invalid coupon");
        return;
      }

      const discountAmount = safeNumber(
        payload.discountAmount ?? payload.discount,
        0
      );

      setDiscount(Math.max(0, discountAmount));
      setAppliedCoupon(payload.couponCode || payload.code || code);
      setCouponCode(payload.couponCode || payload.code || code);

      toast.success("Coupon applied");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to apply coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setDiscount(0);
    setCouponCode("");
    setAppliedCoupon(null);
  };

  /* ---------------- ORDER HELPERS ---------------- */
  const buildOrderPayload = () => {
    if (!values.selectedAddress) {
      throw new Error("Please complete your address");
    }

    const cleanAddress = {
      name: normalize(values.selectedAddress.fullName || values.selectedAddress.name),
      phone: String(normalize(values.selectedAddress.phone) || ""),
      street: normalize(
        values.selectedAddress.addressLine1 || values.selectedAddress.address
      ),
      city: normalize(values.selectedAddress.city),
      state: normalize(values.selectedAddress.state),
      pincode: String(normalize(values.selectedAddress.pincode) || ""),
    };

    if (!cleanAddress.name || cleanAddress.name.length < 2) {
      throw new Error("Full name is too short");
    }

    if (!/^\d{10}$/.test(cleanAddress.phone)) {
      throw new Error("Invalid 10-digit phone number");
    }

    if (!cleanAddress.street || cleanAddress.street.length < 5) {
      throw new Error("Address is too short");
    }

    if (!cleanAddress.city || !cleanAddress.state) {
      throw new Error("Please complete city and state");
    }

    if (!/^\d{6}$/.test(cleanAddress.pincode)) {
      throw new Error("Invalid 6-digit pincode");
    }

    if (!items.length) {
      throw new Error("Your cart is empty");
    }

    const orderItems = items.map((item) => {
      const productId = item.id || item._id || item.productId;
      if (!productId) throw new Error("Invalid product in cart");

      return {
        productId: String(productId),
        quantity: Math.max(1, safeNumber(item.quantity, 1)),
        price: safeNumber(item.price),
        size: item.size || item.topSize || item.variantSize || undefined,
        color: item.color || item.colorName || undefined,
        variantId: item.variantId || item.variant?._id || undefined,
      };
    });

    return {
      items: orderItems,
      address: cleanAddress,
      paymentMethod: values.paymentMethod === "COD" ? "COD" : "RAZORPAY",
      couponCode: appliedCoupon || undefined,
      charges: {
        subtotal: safeNumber(charges.subtotal),
        tax: safeNumber(charges.tax),
        delivery: safeNumber(charges.delivery),
        discount: safeNumber(charges.discount),
        codFee: safeNumber(charges.codFee),
        total: safeNumber(charges.total),
      },
      buyNow: Boolean(buyNowProduct),
    };
  };

  const postOrderToBackend = async (body) => {
    try {
      const endpoint = ENDPOINTS?.ORDERS?.BASE || "/orders";
      const res = await api.post(endpoint, body);
      return res?.data?.data || res?.data || res;
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?._errors?.[0] ||
        err?.message ||
        "Failed to place order";

      throw new Error(errMsg);
    }
  };

  const createRazorpayOrder = async (amount) => {
    const res = await api.post("/payments/create", { amount });
    return res?.data?.data || res?.data || res;
  };

  /* ---------------- ORDER ---------------- */
  const placeOrder = async () => {
    if (loading) return;

    let payload;

    try {
      payload = buildOrderPayload();
    } catch (err) {
      toast.error(err.message);
      return;
    }

    setLoading(true);

    try {
      if (payload.paymentMethod === "RAZORPAY") {
        if (!window.Razorpay) {
          throw new Error("Payment gateway is not loaded. Please refresh and try again.");
        }

        const razorpayOrder = await createRazorpayOrder(payload.charges.total);

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY || "rzp_test_your_key",
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency || "INR",
          name: "Doller Coach",
          description: "Fashion Purchase",
          order_id: razorpayOrder.id || razorpayOrder.orderId,
          handler: async (response) => {
            try {
              setLoading(true);

              await postOrderToBackend({
                ...payload,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });

              toast.success("Payment successful!");
              navigate("/order-success", { replace: true });
            } catch (err) {
              toast.error(err.message);
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: payload.address.name,
            contact: payload.address.phone,
          },
          theme: { color: "#000000" },
          modal: {
            ondismiss: () => setLoading(false),
          },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", (response) => {
          setLoading(false);
          toast.error(
            response?.error?.description
              ? `Payment failed: ${response.error.description}`
              : "Payment failed"
          );
        });

        razorpay.open();
        return;
      }

      await postOrderToBackend(payload);
      toast.success("Order placed successfully");
      navigate("/order-success", { replace: true });
    } catch (err) {
      toast.error(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  if (!isInitialized || (cartLoading && items.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* HEADER */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-black"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <h1 className="font-black uppercase tracking-tight">Checkout</h1>

          <div className="flex items-center text-emerald-600 text-[10px] font-black uppercase tracking-widest gap-1">
            <Lock size={14} /> Secure
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 md:py-8 grid lg:grid-cols-12 gap-5">
        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6">
          {step === 1 && (
            <SmartCheckoutAddress onAddressComplete={handleAddressComplete} />
          )}

          {step === 2 && (
            <PaymentMethods
              selected={values.paymentMethod}
              onSelect={handlePaymentSelect}
            />
          )}

          {step === 3 && (
            <div className="surface p-5 md:p-6 space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase tracking-tighter">
                  Review Your Order
                </h2>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-900 underline"
                >
                  Edit Details
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Delivery Address
                    </p>

                    {values.selectedAddress ? (
                      <div className="space-y-1">
                        <p className="font-black text-sm uppercase tracking-tight">
                          {values.selectedAddress.fullName ||
                            values.selectedAddress.name}
                        </p>
                        <p className="text-xs text-slate-500 font-bold">
                          {values.selectedAddress.phone}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed mt-2">
                          {values.selectedAddress.addressLine1 ||
                            values.selectedAddress.address}
                        </p>
                        <p className="text-xs text-slate-600">
                          {values.selectedAddress.city},{" "}
                          {values.selectedAddress.state}
                        </p>
                        <p className="text-xs text-slate-600 font-black tracking-widest mt-1">
                          {values.selectedAddress.pincode}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-500 py-4">
                        <AlertCircle size={16} />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                          No address found
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Payment Method
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <Lock size={16} className="text-slate-600" />
                      </div>

                      <p className="font-black text-xs uppercase tracking-widest">
                        {values.paymentMethod}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTION */}
          <button
            type="button"
            onClick={() => {
              if (step === 1 && !isAddressValid(values.selectedAddress)) {
                toast.error("Please provide a complete delivery address");
                return;
              }

              if (step < 3) {
                setStep(step + 1);
                return;
              }

              placeOrder();
            }}
            disabled={loading}
            className="w-full btn-luxury h-12 disabled:opacity-50"
          >
            {loading
              ? "Processing Order..."
              : step < 3
                ? "Continue to Payment"
                : "Complete Purchase"}
          </button>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 space-y-4">
          <CouponSection
            code={couponCode}
            setCode={setCouponCode}
            onApply={applyCoupon}
            onRemove={removeCoupon}
            isApplied={Boolean(appliedCoupon)}
            isLoading={couponLoading}
            subtotal={charges.subtotal}
          />

          <OrderSummary
            items={items}
            subtotal={charges.subtotal}
            gstAmount={charges.tax}
            deliveryFee={charges.delivery}
            discountAmount={charges.discount}
            codFee={charges.codFee}
            total={charges.total}
          />

          {!isAddressValid(values.selectedAddress) && (
            <div className="surface p-3 flex gap-2 text-red-600 text-xs font-bold">
              <AlertCircle size={16} />
              Please complete your address
            </div>
          )}

          <div className="surface p-3 flex gap-3 text-xs text-slate-500 font-bold">
            <ShieldCheck size={14} /> Secure payment
            <Truck size={14} /> Fast delivery
          </div>
        </div>
      </div>
    </div>
  );
}
