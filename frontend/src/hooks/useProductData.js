import { useState, useEffect, useCallback, useRef } from "react";
import { safeApi } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { mapProduct } from "../api/dynamicMapper";

/**
 * Custom hook for fetching product data with robust error handling
 * Handles race conditions, cancellations, retries, and state management
 */
export const useProductData = (productId) => {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const isAbortError = (err) => {
    return (
      err?.name === "AbortError" ||
      err?.name === "CanceledError" ||
      err?.code === "ERR_CANCELED" ||
      err?.message?.toLowerCase?.().includes("canceled") ||
      err?.message?.toLowerCase?.().includes("aborted")
    );
  };

  const getResponseData = (response) => {
    return response?.data ?? response;
  };

  const isSuccessfulResponse = (response) => {
    if (!response) return false;
    if (response.success === false) return false;
    return true;
  };

  const getReviewsEndpoint = (id) => {
    if (ENDPOINTS?.REVIEWS?.BY_PRODUCT) {
      return ENDPOINTS.REVIEWS.BY_PRODUCT(id);
    }

    return `/reviews/${id}`;
  };

  const safeSetState = useCallback((requestId, setter, value) => {
    if (isMountedRef.current && requestIdRef.current === requestId) {
      setter(value);
    }
  }, []);

  const clearPending = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const normalizeReviews = (response) => {
    const data = getResponseData(response);

    if (Array.isArray(data)) {
      return {
        list: data,
        average: 0,
        total: data.length,
      };
    }

    const list =
      data?.reviews ||
      data?.data?.reviews ||
      data?.items ||
      data?.data ||
      [];

    const safeList = Array.isArray(list) ? list : [];

    return {
      list: safeList,
      average: Number(data?.avgRating || data?.averageRating || data?.rating || 0),
      total: Number(data?.totalReviews || data?.count || safeList.length || 0),
    };
  };

  const normalizeProducts = (response) => {
    const data = getResponseData(response);

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.products)) return data.data.products;

    return [];
  };

  const fetchProduct = useCallback(
    async (id, signal, requestId) => {
      const response = await safeApi.get(ENDPOINTS.PRODUCTS.GET(id), {
        signal,
      });

      if (!isSuccessfulResponse(response)) {
        throw new Error(response?.message || "Failed to load product");
      }

      const data = getResponseData(response);
      const rawProduct = data?.product || data?.data || data;

      if (!rawProduct || typeof rawProduct !== "object") {
        throw new Error("Invalid product data received");
      }

      const mappedProduct = mapProduct(rawProduct);

      if (!mappedProduct) {
        throw new Error("Unable to read product details");
      }

      safeSetState(requestId, setProduct, mappedProduct);
      return mappedProduct;
    },
    [safeSetState]
  );

  const fetchReviews = useCallback(
    async (id, signal, requestId) => {
      try {
        const response = await safeApi.get(getReviewsEndpoint(id), {
          signal,
        });

        if (!isSuccessfulResponse(response)) {
          safeSetState(requestId, setReviews, []);
          safeSetState(requestId, setAvgRating, 0);
          safeSetState(requestId, setTotalReviews, 0);
          return;
        }

        const normalized = normalizeReviews(response);

        safeSetState(requestId, setReviews, normalized.list);
        safeSetState(requestId, setAvgRating, normalized.average);
        safeSetState(requestId, setTotalReviews, normalized.total);
      } catch (err) {
        if (isAbortError(err)) throw err;

        safeSetState(requestId, setReviews, []);
        safeSetState(requestId, setAvgRating, 0);
        safeSetState(requestId, setTotalReviews, 0);
      }
    },
    [safeSetState]
  );

  const fetchRelated = useCallback(
    async (currentProduct, signal, requestId) => {
      try {
        const currentId = String(
          currentProduct?.id || currentProduct?._id || productId || ""
        );

        const readProducts = async (query) => {
          const response = await safeApi.get(
            `${ENDPOINTS.PRODUCTS.LIST}?${query}`,
            { signal }
          );

          if (!isSuccessfulResponse(response)) return [];

          return normalizeProducts(response)
            .map(mapProduct)
            .filter(Boolean)
            .filter((item) => String(item?.id || item?._id) !== currentId)
            .slice(0, 8);
        };

        const category = currentProduct?.category;
        const categoryCandidates = [
          category?._id,
          category?.id,
          category?.slug,
          category?.name,
          category?.main,
          typeof category === "string" ? category : "",
        ]
          .filter(Boolean)
          .map(String)
          .filter((value, index, list) => list.indexOf(value) === index);

        for (const candidate of categoryCandidates) {
          const products = await readProducts(
            `category=${encodeURIComponent(candidate)}&limit=8`
          );

          if (products.length) {
            safeSetState(requestId, setRelated, products);
            return;
          }
        }

        const gender =
          currentProduct?.gender ||
          currentProduct?.category?.gender ||
          currentProduct?.category?.main ||
          "";

        if (gender) {
          const products = await readProducts(
            `gender=${encodeURIComponent(gender)}&limit=8`
          );

          if (products.length) {
            safeSetState(requestId, setRelated, products);
            return;
          }
        }

        const fallbackProducts = await readProducts("limit=8");
        safeSetState(requestId, setRelated, fallbackProducts);
      } catch (err) {
        if (isAbortError(err)) throw err;
        safeSetState(requestId, setRelated, []);
      }
    },
    [productId, safeSetState]
  );

  const fetchAllData = useCallback(
    async ({ isRetry = false } = {}) => {
      if (!productId) {
        setProduct(null);
        setReviews([]);
        setAvgRating(0);
        setTotalReviews(0);
        setRelated([]);
        setLoading(false);
        setError(null);
        return;
      }

      clearPending();

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        safeSetState(requestId, setLoading, true);
        safeSetState(requestId, setError, null);

        const productData = await fetchProduct(
          productId,
          controller.signal,
          requestId
        );

        await Promise.allSettled([
          fetchReviews(productId, controller.signal, requestId),
          fetchRelated(productData, controller.signal, requestId),
        ]);

        retryCountRef.current = 0;
      } catch (err) {
        if (isAbortError(err)) return;

        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load product data";

        safeSetState(requestId, setError, message);

        if (!isRetry && retryCountRef.current < 2) {
          retryCountRef.current += 1;

          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchAllData({ isRetry: true });
            }
          }, 1000 * retryCountRef.current);
        }
      } finally {
        safeSetState(requestId, setLoading, false);
      }
    },
    [
      productId,
      clearPending,
      safeSetState,
      fetchProduct,
      fetchReviews,
      fetchRelated,
    ]
  );

  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;

    fetchAllData();

    return () => {
      clearPending();
      requestIdRef.current += 1;
    };
  }, [fetchAllData, clearPending]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearPending();
    };
  }, [clearPending]);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    fetchAllData();
  }, [fetchAllData]);

  return {
    product,
    reviews,
    avgRating,
    totalReviews,
    related,
    loading,
    error,
    refetch,
  };
};

export default useProductData;
