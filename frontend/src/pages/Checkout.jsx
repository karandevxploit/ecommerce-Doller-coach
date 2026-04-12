import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore, useCartStore } from "../store";
import { api } from "../api/client";
import { 
  ArrowLeft, 
  Lock,
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { formatPrice } from "../utils/format";
import AddressManager from "../components/AddressManager";
import OrderSummary from "../components/checkout/OrderSummary";
import PaymentMethods from "../components/checkout/PaymentMethods";
import CouponSection from "../components/checkout/CouponSection";
import { useForm } from "../hooks/useForm";
import { checkoutValidator } from "../utils/validation";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const buyNowProduct = location.state?.buyNowProduct;
  
  const { isAuthenticated, fetchUser } = useAuthStore();
  const { items, getCartTotal, fetchCart } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [hasAppliedCoupon, setHasAppliedCoupon] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const { values, errors, setValues, handleSubmit } = useForm(
    { selectedAddress: null, paymentMethod: "UPI" },
    checkoutValidator
  );

  const checkoutItems = useMemo(() => buyNowProduct ? [buyNowProduct] : items, [buyNowProduct, items]);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    if (checkoutItems.length === 0) navigate("/cart");
    
    const fetchCoupons = async () => {
      try {
        const res = await api.get("/coupons");
        const list = Array.isArray(res) ? res : res.data || [];
        setAvailableCoupons(list);
      } catch (err) {
        console.error("Coupon Discovery Error:", err);
      }
    };
    fetchCoupons();
  }, [isAuthenticated, checkoutItems.length, navigate]);

  const subtotal = useMemo(() => 
    buyNowProduct ? buyNowProduct.price * (buyNowProduct.quantity || 1) : items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  [buyNowProduct, items]);

  const delivery = 0; // FREE DELIVERY EVERYWHERE
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal - discount + gst;
  
  const handleApplyCoupon = async (code) => {
    const normalizedCode = (code || "").trim().toUpperCase();
    if (!normalizedCode) return;

    // Optional: Special 'SAVE50' logic as per request
    if (normalizedCode === "SAVE50") {
        setDiscount(50);
        setAppliedCoupon({ code: "SAVE50", discountAmount: 50 });
        setHasAppliedCoupon(true);
        setCouponCode("SAVE50");
        toast.success("Coupon SAVE50 Applied: ₹50 Off");
        return;
    }

    setIsApplyingCoupon(true);
    try {
      const res = await api.post("/coupons/apply", { 
        code: normalizedCode, 
        cartTotal: subtotal
      });
      
      if (res.success) {
        const discValue = res.discount || 0;
        setDiscount(discValue);
        setAppliedCoupon({ code: res.couponCode, discountAmount: discValue });
        setHasAppliedCoupon(true);
        setCouponCode(res.couponCode);
        toast.success(res.message);
      } else {
        toast.error(res.message || "Invalid coupon");
        setDiscount(0);
        setHasAppliedCoupon(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Validation technical failure");
      setDiscount(0);
      setHasAppliedCoupon(false);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setHasAppliedCoupon(false);
    setDiscount(0);
    setCouponCode("");
    setAppliedCoupon(null);
    toast.success("Coupon removed");
  };

  const isAddressComplete = useCallback((addr) => {
    if (!addr) return false;
    const { name, phone, addressLine1, city, state, pincode } = addr;
    return !!(name?.trim() && phone?.length >= 10 && addressLine1?.trim() && city?.trim() && state?.trim() && pincode?.length === 6);
  }, []);

  const initiateRazorpay = useCallback(async (oid, payData) => {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        toast.error("Razorpay script not found");
        return reject("No RZP");
      }

      const options = {
        key: payData.keyId,
        amount: payData.order.amount,
        currency: "INR",
        name: "DOLLER Coach",
        description: "Order Payment",
        order__id: payData.order.id,
        theme: { color: "#0f172a" },
        handler: async (response) => {
          try {
            const verify = await api.post("/payment/verify", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderId: oid,
            });
            if (verify.verified) {
              toast.success("Payment verified");
              resolve(true);
            } else {
              toast.error("Verification failed");
              resolve(false);
            }
          } catch (err) {
            toast.error("Payment verification error");
            reject(err);
          }
        },
        modal: { ondismiss: () => setLoading(false) }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (res) => {
        toast.error(res.error.description || "Payment failed");
        setLoading(false);
      });
      rzp.open();
    });
  }, []);

  const processOrder = async (formValues) => {
    const { selectedAddress, paymentMethod } = formValues;
    if (!isAddressComplete(selectedAddress)) {
      return toast.error("Please complete your shipping address details.");
    }

    setLoading(true);
    try {
      const payload = {
        products: checkoutItems.map(item => ({
          productId: item.id || item._id,
          title: item.title,
          quantity: item.quantity || 1,
          price: item.price,
          size: item.size || "",
          topSize: item.topSize || "",
          bottomSize: item.bottomSize || "",
          image: item.image || ""
        })),
        subtotal,
        discount,
        gst,
        delivery,
        total,
        address: {
          name: selectedAddress.name,
          phone: selectedAddress.phone,
          address: selectedAddress.addressLine1,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode
        },
        paymentMethod: paymentMethod.toUpperCase(),
        couponCode: hasAppliedCoupon ? couponCode : null,
      };

      const orderRes = await api.post("/orders", payload);
      const orderId = orderRes._id || orderRes.id;

      if (paymentMethod === "COD") {
        toast.success("Order Placed Successfully");
        await fetchCart();
        navigate(`/order-success/${orderId}`);
        return;
      }

      // Online Payment Init
      const payRes = await api.post("/payment/create-order", { orderId });
      const success = await initiateRazorpay(orderId, payRes);
      
      if (success) {
        await fetchCart();
        navigate(`/order-success/${orderId}`);
      }
    } catch (err) {
      console.error("Checkout Error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* HEADER SECTION */}
      <div className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-black transition-all group">
            <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <ArrowLeft size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Abort Process</span>
          </button>
          
          <div className="flex flex-col items-center">
             <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter leading-none">Safe Checkout</h1>
             <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Encrypted Transaction Node</p>
          </div>

          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <Lock size={12} strokeWidth={3} />
            <span className="text-[9px] font-black uppercase tracking-widest">Protocol Secure</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* LEFT COLUMN: LOGISTICS & PAYMENT */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 1. SHIPPING ADDRESS */}
            <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 lg:p-10 space-y-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#0f172a] text-white text-xs font-black shadow-lg">01</span>
                    <div className="flex flex-col">
                      <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Shipping Destination</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select your delivery vertex</p>
                    </div>
                  </div>
                </div>

                <AddressManager 
                  onSelect={(addr) => setValues({ ...values, selectedAddress: addr })} 
                  selectedId={values.selectedAddress?._id || values.selectedAddress?.id} 
                />
            </div>

            {/* 2. PAYMENT METHOD */}
            <PaymentMethods 
              selected={values.paymentMethod} 
              onSelect={(m) => setValues({ ...values, paymentMethod: m })} 
            />
          </div>

          {/* RIGHT COLUMN: MANIFEST & SUMMARY */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
            
            <CouponSection 
              code={couponCode}
              setCode={setCouponCode}
              onApply={handleApplyCoupon}
              onRemove={handleRemoveCoupon}
              isApplied={hasAppliedCoupon}
              isLoading={isApplyingCoupon}
              subtotal={subtotal}
              availableCoupons={availableCoupons}
            />

            <OrderSummary 
              items={checkoutItems}
              subtotal={subtotal}
              discountAmount={discount}
              gstAmount={gst}
              deliveryFee={delivery}
              total={total}
            />

            <button 
              onClick={(e) => handleSubmit(e, processOrder)}
              disabled={loading}
              className={`w-full py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] transition-all shadow-2xl flex items-center justify-center gap-3 group relative overflow-hidden ${
                isAddressComplete(values.selectedAddress)
                ? "bg-[#0f172a] text-white hover:bg-black active:scale-[0.98]" 
                : "bg-gray-100 text-gray-300 cursor-not-allowed opacity-70"
              }`}
            >
              {loading ? (
                <div className="h-5 w-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isAddressComplete(values.selectedAddress) ? "Authorize & Place Order" : "Address Data Incomplete"} 
                  <ArrowRight size={18} className={`${isAddressComplete(values.selectedAddress) ? "group-hover:translate-x-2 transition-transform" : "opacity-0"}`} strokeWidth={3} />
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <ShieldCheck size={18} className="text-gray-400 mb-2" />
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest text-center">Secure Vault<br/>Payment</span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <Truck size={18} className="text-gray-400 mb-2" />
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest text-center">Expedited<br/>Logistics</span>
              </div>
            </div>

            {!isAddressComplete(values.selectedAddress) && values.selectedAddress && (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 animate-pulse">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest leading-relaxed">Required fields missing in selected address manifest. Please update destination details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}