import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import CouponCard from "../ui/CouponCard";
import toast from "react-hot-toast";

export default function CouponSection({
  code,
  setCode,
  onApply,
  onRemove,
  isApplied,
  isLoading,
  availableCoupons = [],
}) {
  const [showOffers, setShowOffers] = useState(false);

  const activeCoupons = availableCoupons.filter((c) => c.status === "active");
  const upcomingCoupons = availableCoupons.filter((c) => c.status === "upcoming");

  const handleApply = () => {
    if (!code.trim()) {
      return toast.error("Please enter a coupon code");
    }
    onApply(code);
  };

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Apply Coupon</h3>

        {!isApplied && (activeCoupons.length > 0 || upcomingCoupons.length > 0) && (
          <button
            onClick={() => setShowOffers(!showOffers)}
            className="text-xs text-blue-600 flex items-center gap-1"
          >
            {showOffers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showOffers ? "Hide offers" : "View offers"}
          </button>
        )}
      </div>

      {/* OFFERS LIST */}
      {!isApplied && showOffers && (
        <div className="space-y-4">

          {/* ACTIVE */}
          {activeCoupons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-2">
                Available Offers
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {activeCoupons.map((coupon) => (
                  <CouponCard
                    key={coupon.id || coupon._id}
                    coupon={coupon}
                    onApply={(c) => {
                      setCode(c);
                      onApply(c);
                      setShowOffers(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING */}
          {upcomingCoupons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-500 mb-2">
                Coming Soon
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto opacity-60">
                {upcomingCoupons.map((coupon) => (
                  <CouponCard
                    key={coupon.id || coupon._id}
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

      {/* INPUT */}
      <div className="relative">
        <input
          type="text"
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={isApplied || isLoading}
          className="w-full h-11 px-4 pr-28 border rounded-lg text-sm outline-none focus:border-black"
        />

        {!isApplied ? (
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="absolute right-1 top-1 bottom-1 px-4 bg-black text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-40"
          >
            {isLoading ? "Applying..." : "Apply"}
          </button>
        ) : (
          <button
            onClick={onRemove}
            className="absolute right-1 top-1 bottom-1 px-4 bg-red-100 text-red-600 rounded-lg text-sm flex items-center gap-1"
          >
            <X size={14} /> Remove
          </button>
        )}
      </div>

      {/* SUCCESS */}
      {isApplied && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-600">
          Coupon applied successfully 🎉
        </div>
      )}
    </div>
  );
}