import React, { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export const StatsCard = memo(
    ({ title, value = 0, prevValue = null, icon: Icon, color = "blue", suffix = "" }) => {

        // Safe numeric conversion
        const safeValue = Number(value) || 0;
        const safePrev = prevValue !== null ? Number(prevValue) : null;

        // Trend calculation (safe)
        let diff = 0;
        if (safePrev !== null && safePrev !== 0) {
            diff = ((safeValue - safePrev) / safePrev) * 100;
        }

        const isPositive = diff >= 0;

        const colors = {
            blue: "text-blue-600 bg-blue-50 border-blue-100",
            emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
            amber: "text-amber-600 bg-amber-50 border-amber-100",
            indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
            rose: "text-rose-600 bg-rose-50 border-rose-100",
        };

        // Format value
        const formatValue = () => {
            if (suffix === "$") return `₹${safeValue.toLocaleString()}`; // India friendly
            if (suffix === "%") return `${safeValue}%`;
            return `${safeValue.toLocaleString()}${suffix}`;
        };

        return (
            <motion.div
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">
                            {title}
                        </p>

                        <h3 className="text-2xl font-black text-gray-900">
                            {formatValue()}
                        </h3>

                        {safePrev !== null && safePrev !== 0 && (
                            <div
                                className={`mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase ${isPositive ? "text-emerald-600" : "text-rose-600"
                                    }`}
                            >
                                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {Math.abs(diff).toFixed(1)}% vs Last Period
                            </div>
                        )}
                    </div>

                    <div className={`p-3 rounded-2xl border ${colors[color] || colors.blue}`}>
                        {Icon ? <Icon size={24} /> : null}
                    </div>
                </div>

                {/* Progress bar (runs only once) */}
                <div className="mt-4 h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2 }}
                        className={`h-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"
                            } opacity-20`}
                    />
                </div>
            </motion.div>
        );
    }
);