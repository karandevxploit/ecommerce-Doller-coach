import { useState, useEffect, useCallback, useRef } from "react";
import { analyticsApi } from "../services/analyticsApi";

export const useAnalytics = (range = "7d") => {
    const [data, setData] = useState({
        overview: null,
        traffic: [],
        topProducts: [],
        loading: true,
        error: null,
    });

    const requestIdRef = useRef(0);
    const retryRef = useRef(null);

    const fetchAll = useCallback(async (retryCount = 0) => {
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;

        if (retryCount === 0) {
            setData(prev => ({ ...prev, loading: true, error: null }));
        }

        try {
            const [overview, traffic, topProducts] = await Promise.all([
                analyticsApi.getOverview(range),
                analyticsApi.getTraffic(),
                analyticsApi.getTopProducts(),
            ]);

            // 👉 Ignore stale responses
            if (currentRequestId !== requestIdRef.current) return;

            setData(prev => ({
                ...prev,
                overview,
                traffic,
                topProducts,
                loading: false,
                error: null,
            }));

        } catch (err) {
            if (retryCount < 3) {
                retryRef.current = setTimeout(() => {
                    fetchAll(retryCount + 1);
                }, 1000 * (retryCount + 1));
            } else {
                setData(prev => ({
                    ...prev,
                    loading: false,
                    error: err?.message || "Analytics fetch failed",
                }));
            }
        }
    }, [range]);

    useEffect(() => {
        fetchAll();

        return () => {
            if (retryRef.current) {
                clearTimeout(retryRef.current);
            }
        };
    }, [fetchAll]);

    return {
        ...data,
        refresh: () => fetchAll(0),
    };
};