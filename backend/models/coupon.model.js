const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { 
      type: String, 
      required: true, 
      unique: true, 
      uppercase: true, 
      trim: true 
    },
    discountType: { 
      type: String, 
      enum: ["percentage", "fixed"], 
      required: true 
    },
    discountValue: { 
      type: Number, 
      required: true 
    },
    minOrderAmount: { 
      type: Number, 
      default: 0 
    },
    maxDiscount: { 
      type: Number, 
      default: null // null means no cap
    },
    expiryDate: { 
      type: Date, 
      required: true 
    },
    startDate: { 
      type: Date, 
      default: null 
    },
    endDate: { 
      type: Date, 
      default: null 
    },
    usageLimit: { 
      type: Number, 
      default: null // null means unlimited
    },
    usedCount: { 
      type: Number, 
      default: 0 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
