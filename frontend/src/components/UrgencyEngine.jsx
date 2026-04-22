import { useState, useEffect } from "react";
import { Zap, Flame, Box } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import socket from "../api/socket";

/* ---------------- LIVE VIEWERS ---------------- */
export function LiveViewers({ productId }) {
    const [viewers, setViewers] = useState(0);
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
        if (!productId) return;

        socket.emit("join_product", productId);

        const handleViewers = ({ count }) => {
            if (typeof count === "number") {
                setViewers(count);
            }
        };

        socket.on("viewers_count", handleViewers);

        return () => {
            socket.emit("leave_product", productId);
            socket.off("viewers_count", handleViewers);
        };
    }, [productId]);

    if (!viewers) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100"
        >
            <Flame
                size={14}
                className={prefersReducedMotion ? "" : "animate-pulse"}
            />
            <span>{viewers} people are viewing this product</span>
        </div>
    );
}

/* ---------------- INVENTORY ALERT ---------------- */
export function InventoryAlert({ stock }) {
    const prefersReducedMotion = useReducedMotion();

    if (typeof stock !== "number" || stock > 10 || stock <= 0) return null;

    return (
        <motion.div
            initial={false}
            animate={
                prefersReducedMotion ? {} : { x: [0, -2, 2, 0] }
            }
            transition={{ duration: 0.4, repeat: prefersReducedMotion ? 0 : Infinity, repeatDelay: 6 }}
            role="alert"
            className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100"
        >
            <Box size={14} />
            <span>Only {stock} left in stock</span>
        </motion.div>
    );
}

/* ---------------- SALES PULSE ---------------- */
export function SalesPulse() {
    const prefersReducedMotion = useReducedMotion();

    const cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad"];
    const [pulse, setPulse] = useState(null);

    useEffect(() => {
        const showPulse = () => {
            const city = cities[Math.floor(Math.random() * cities.length)];
            setPulse(`Order placed from ${city}`);
            setTimeout(() => setPulse(null), 4000);
        };

        const interval = setInterval(showPulse, 20000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed bottom-24 left-4 z-[45] hidden md:block">
            <AnimatePresence>
                {pulse && (
                    <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg flex items-center gap-3 max-w-xs"
                    >
                        <div className="bg-green-500 p-2 rounded-full">
                            <Zap size={14} className="text-white" />
                        </div>

                        <div>
                            <p className="text-xs font-medium text-slate-900">
                                Recent order
                            </p>
                            <p className="text-xs text-slate-500">
                                {pulse}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}