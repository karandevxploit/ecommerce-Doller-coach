import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCartStore, useAuthStore } from "../store";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import {
  ArrowLeft,
  Lock,
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import AddressManager from "../components/AddressManager";
import OrderSummary from "../components/checkout/OrderSummary";
import PaymentMethods from "../components/checkout/PaymentMethods";
import CouponSection from "../components/checkout/CouponSection";
import { useForm } from "../hooks/useForm";
import { checkoutValidator } from "../utils/validation";
import SafeText from "../components/common/SafeText";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const buyNowProduct = location.state?.buyNowProduct;

  const { isAuthenticated } = useAuthStore();
  const { cart = [], fetchCart } = useCartStore();

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

  const items = useMemo(
    () => (buyNowProduct ? [buyNowProduct] : cart),
    [buyNowProduct, cart]
  );

  /* ---------------- GUARDS ---------------- */
  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    if (!items.length) navigate("/cart");
  }, [isAuthenticated, items.length]);

  /* ---------------- TOTALS ---------------- */
  const subtotal = useMemo(() => {
    return items.reduce(
      (acc, i) => acc + (i.price || 0) * (i.quantity || 1),
      0
    );
  }, [items]);

  const gst = Math.round(subtotal * 0.05);
  const delivery = subtotal > 499 ? 0 : 40;
  const total = subtotal + gst + delivery - discount;

  /* ---------------- ADDRESS VALIDATION ---------------- */
  const isAddressValid = useCallback((a) => {
    if (!a) return false;
    return (
      a.name &&
      a.phone?.length >= 10 &&
      a.addressLine1 &&
      a.city &&
      a.state &&
      a.pincode?.length === 6
    );
  }, []);

  /* ---------------- COUPON ---------------- */
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    try {
      const res = await api.post(ENDPOINTS.COUPONS.APPLY, {
        code: couponCode,
        cartTotal: subtotal,
      });

      if (res?.success) {
        setDiscount(res.discount || 0);
        setAppliedCoupon(res.couponCode);
        toast.success("Coupon applied");
      } else {
        toast.error(res?.message || "Invalid coupon");
        setDiscount(0);
      }
    } catch (err) {
      toast.error("Failed to apply coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setDiscount(0);
    setCouponCode("");
    setAppliedCoupon(null);
  };

  /* ---------------- ORDER ---------------- */
  const placeOrder = async () => {
    if (!isAddressValid(values.selectedAddress)) {
      return toast.error("Please complete your address.");
    }

    setLoading(true);

    try {
      const payload = {
        products: items.map((i) => ({
          productId: i.id || i._id,
          quantity: i.quantity || 1,
          price: i.price,
        })),
        subtotal,
        gst,
        delivery,
        discount,
        total,
        address: values.selectedAddress,
        paymentMethod: values.paymentMethod,
      };

      const order = await api.post(ENDPOINTS.ORDERS.BASE, payload);
      const orderId = order.id || order._id;

      if (values.paymentMethod === "COD") {
        toast.success("Order placed successfully");
        await fetchCart();
        navigate(`/order-success/${orderId}`);
        return;
      }

      // Razorpay
      const pay = await api.post(
        ENDPOINTS.PAYMENTS.CREATE_ORDER,
        { orderId }
      );

      const rzp = new window.Razorpay({
        key: pay.keyId,
        order_id: pay.order.id,
        amount: pay.order.amount,
        handler: async (res) => {
          await api.post(ENDPOINTS.PAYMENTS.VERIFY, {
            ...res,
            orderId,
          });
          toast.success("Payment successful");
          navigate(`/order-success/${orderId}`);
        },
      });

      rzp.open();
    } catch (err) {
      toast.error("Order failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() =>
              step > 1 ? setStep(step - 1) : navigate(-1)
            }
            className="flex items-center gap-2 text-sm text-gray-500"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <h1 className="font-semibold">Checkout</h1>

          <div className="flex items-center text-green-600 text-xs gap-1">
            <Lock size={14} /> Secure
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-10">
        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6">
          {step === 1 && (
            <AddressManager
              onSelect={(a) =>
                setValues({ ...values, selectedAddress: a })
              }
            />
          )}

          {step === 2 && (
            <PaymentMethods
              selected={values.paymentMethod}
              onSelect={(m) =>
                setValues({ ...values, paymentMethod: m })
              }
            />
          )}

          {step === 3 && (
            <div className="bg-white p-6 rounded-xl border space-y-4">
              <h2 className="font-semibold">Review</h2>

              <div>
                <p className="text-sm text-gray-500">Address</p>
                <SafeText>{values.selectedAddress?.name}</SafeText>
              </div>

              <div>
                <p className="text-sm text-gray-500">Payment</p>
                <p>{values.paymentMethod}</p>
              </div>
            </div>
          )}

          {/* ACTION */}
          <button
            onClick={() =>
              step < 3 ? setStep(step + 1) : placeOrder()
            }
            disabled={loading}
            className="w-full h-12 bg-black text-white rounded-lg"
          >
            {loading
              ? "Processing..."
              : step < 3
                ? "Continue"
                : "Place Order"}
          </button>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 space-y-4">
          <CouponSection
            code={couponCode}
            setCode={setCouponCode}
            onApply={applyCoupon}
            onRemove={removeCoupon}
            isApplied={!!appliedCoupon}
            isLoading={couponLoading}
            subtotal={subtotal}
          />

          <OrderSummary
            items={items}
            subtotal={subtotal}
            gstAmount={gst}
            deliveryFee={delivery}
            discountAmount={discount}
            total={total}
          />

          {!isAddressValid(values.selectedAddress) && (
            <div className="flex gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              Please complete your address
            </div>
          )}

          <div className="flex gap-3 text-xs text-gray-500">
            <ShieldCheck size={14} /> Secure payment
            <Truck size={14} /> Fast delivery
          </div>
        </div>
      </div>
    </div>
  );
}