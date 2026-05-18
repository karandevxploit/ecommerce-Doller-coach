import { useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import CouponCard from "../ui/CouponCard";
import toast from "react-hot-toast";

const normalizeStatus = (status) => {
  return String(status || "").trim().toLowerCase();
};

const normalizeCode = (value) => {
  return String(value || "").trim().toUpperCase();
};

const getCouponCode = (coupon) => {
  return normalizeCode(coupon?.code || coupon?.couponCode || coupon?.title);
};

const getCouponKey = (coupon, index) => {
  return String(coupon?.id || coupon?._id || getCouponCode(coupon) || `coupon-${index}`);
};

export default function CouponSection({
  code = "",
  setCode = () => { },
  onApply = () => { },
  onRemove = () => { },
  isApplied = false,
  isLoading = false,
  availableCoupons = [],
}) {
  const [showOffers, setShowOffers] = useState(false);

  const coupons = useMemo(() => {
    return Array.isArray(availableCoupons) ? availableCoupons.filter(Boolean) : [];
  }, [availableCoupons]);

  const activeCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const status = normalizeStatus(coupon?.status);
      return status === "active" || coupon?.isActive === true;
    });
  }, [coupons]);

  const upcomingCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const status = normalizeStatus(coupon?.status);
      return status === "upcoming" || status === "coming";
    });
  }, [coupons]);

  const handleApply = (value = code) => {
    if (isLoading || isApplied) return;

    const couponCode = normalizeCode(value);

    if (!couponCode) {
      toast.error("Please enter a coupon code");
      return;
    }

    setCode(couponCode);
    onApply(couponCode);
  };

  const handleRemove = () => {
    if (isLoading) return;
    onRemove();
  };

  const hasOffers = activeCoupons.length > 0 || upcomingCoupons.length > 0;

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Apply Coupon</h3>

        {!isApplied && hasOffers && (
          <button
            type="button"
            onClick={() => setShowOffers((prev) => !prev)}
            className="text-xs text-blue-600 flex items-center gap-1"
          >
            {showOffers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showOffers ? "Hide offers" : "View offers"}
          </button>
        )}
      </div>

      {!isApplied && showOffers && (
        <div className="space-y-4">
          {activeCoupons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-2">
                Available Offers
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {activeCoupons.map((coupon, index) => (
                  <CouponCard
                    key={getCouponKey(coupon, index)}
                    coupon={coupon}
                    onApply={(couponValue) => {
                      const couponCode = normalizeCode(couponValue || getCouponCode(coupon));
                      handleApply(couponCode);
                      setShowOffers(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {upcomingCoupons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-500 mb-2">
                Coming Soon
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto opacity-60">
                {upcomingCoupons.map((coupon, index) => (
                  <CouponCard
                    key={getCouponKey(coupon, index)}
                    coupon={coupon}
                  />
                ))}
              </div>
            </div>
          )}

          {activeCoupons.length === 0 && upcomingCoupons.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">
              No offers available right now
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          disabled={isApplied || isLoading}
          className="w-full h-11 px-4 pr-28 border rounded-lg text-sm outline-none focus:border-black"
        />

        {!isApplied ? (
          <button
            type="button"
            onClick={() => handleApply()}
            disabled={isLoading}
            className="absolute right-1 top-1 bottom-1 px-4 bg-black text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-40"
          >
            {isLoading ? "Applying..." : "Apply"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isLoading}
            className="absolute right-1 top-1 bottom-1 px-4 bg-red-100 text-red-600 rounded-lg text-sm flex items-center gap-1 disabled:opacity-40"
          >
            <X size={14} /> Remove
          </button>
        )}
      </div>

      {isApplied && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-600">
          Coupon applied successfully
        </div>
      )}
    </div>
  );
}
