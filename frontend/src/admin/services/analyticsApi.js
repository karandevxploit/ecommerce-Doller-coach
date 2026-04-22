import { api } from "../../api/client";

/**
 * ENTERPRISE ANALYTICS API SERVICE (FINAL)
 * - Consistent response parsing
 * - Safe error handling
 * - Clean data return (no axios wrapper leak)
 */

const extractData = (res) => {
    return res?.data ?? null;
};

const handleError = (err, fallbackMessage) => {
    console.error("ANALYTICS API ERROR:", err?.response?.data || err?.message);
    throw new Error(err?.response?.data?.message || fallbackMessage);
};

export const analyticsApi = {
    /**
     * KPI Overview (Revenue, Orders, Users)
     */
    getOverview: async (range = "7d") => {
        try {
            const res = await api.get("/admin/analytics/overview", {
                params: { range },
            });
            return extractData(res);
        } catch (err) {
            handleError(err, "Failed to fetch overview");
        }
    },

    /**
     * Traffic Trend Data
     */
    getTraffic: async () => {
        try {
            const res = await api.get("/admin/analytics/traffic");
            return Array.isArray(res?.data) ? res.data : [];
        } catch (err) {
            handleError(err, "Failed to fetch traffic");
        }
    },

    /**
     * Top Products
     */
    getTopProducts: async () => {
        try {
            const res = await api.get("/admin/analytics/top-products");
            return Array.isArray(res?.data) ? res.data : [];
        } catch (err) {
            handleError(err, "Failed to fetch top products");
        }
    },

    /**
     * Active Users (Realtime)
     */
    getActiveUsers: async () => {
        try {
            const res = await api.get("/admin/analytics/active-users");
            return extractData(res);
        } catch (err) {
            handleError(err, "Failed to fetch active users");
        }
    },

    /**
     * System Health Metrics
     */
    getHealth: async () => {
        try {
            const res = await api.get("/admin/analytics/health");
            return extractData(res);
        } catch (err) {
            handleError(err, "Failed to fetch health data");
        }
    },
};