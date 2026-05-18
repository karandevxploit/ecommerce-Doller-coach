import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isCancelledRequest } from "../../api/client";
import { RefreshCw, Truck } from "lucide-react";
import Button from "../../components/ui/Button";

const getShipmentList = (responseData) => {
  const payload = responseData?.data || responseData || {};

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.shipments)) return payload.shipments;
  if (Array.isArray(payload.items)) return payload.items;

  return [];
};

const isCancelError = (err) => {
  return (
    isCancelledRequest?.(err) ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1971) return "-";
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1971) return "-";
  return date.toLocaleString();
};

const normalizeShipment = (row, index) => {
  return {
    id: row?._id || row?.id || row?.orderId || `shipment-${index}`,
    orderId: row?.orderId || row?.order?._id || row?.order?.id || "",
    customer:
      row?.customer ||
      row?.customerName ||
      row?.user?.name ||
      row?.order?.user?.name ||
      "Customer",
    awb: row?.awb || row?.awbCode || row?.shipment?.awb_code || row?.shiprocket?.awbCode || row?.trackingNumber || row?.tracking_number || "",
    courier: row?.courier || row?.courierName || row?.shipment?.courier_name || row?.shiprocket?.courierName || row?.carrier || "",
    status: row?.shipmentStatus || row?.shipment_status || row?.shipment?.status || row?.shiprocket?.status || row?.status || "pending",
    estimatedDelivery: row?.estimatedDelivery || row?.estimated_delivery || row?.shipment?.estimated_delivery || row?.eta || null,
    updatedAt: row?.shipment?.last_updated_at || row?.updatedAt || row?.updated_at || row?.lastUpdated || null,
    error: row?.lastShipmentError || row?.shipment?.last_error || row?.shiprocket?.error || "",
  };
};

export default function Shipments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchShipments = useCallback(
    async (signal) => {
      try {
        setLoading(true);

        const res = await api.get("/admin/shipments", {
          params: {
            ...(status ? { status } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            limit: 50,
          },
          signal,
        });

        const list = getShipmentList(res?.data).map(normalizeShipment);
        setRows(list);
      } catch (err) {
        if (isCancelError(err)) return;

        console.error("SHIPMENTS_FETCH_ERROR:", err?.response?.data || err?.message);
        setRows([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [status, from, to]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchShipments(controller.signal);

    return () => controller.abort();
  }, [fetchShipments]);

  useEffect(() => {
    const timer = setInterval(() => {
      const controller = new AbortController();
      fetchShipments(controller.signal);
    }, 15000);

    return () => clearInterval(timer);
  }, [fetchShipments]);

  const statuses = useMemo(
    () => ["pending", "booked", "shipped", "in_transit", "delivered", "failed"],
    []
  );

  return (
    <div className="admin-shell">
      <div className="admin-card p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="admin-heading flex items-center gap-2">
          <Truck size={20} />
          Shipments
        </h1>

        <Button onClick={() => fetchShipments()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="admin-card p-4 flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="control-input px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="control-input px-3 py-2 text-sm"
        />

        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="control-input px-3 py-2 text-sm"
        />
      </div>

      <div className="admin-card overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading shipments...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Order ID</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">AWB</th>
                <th className="text-left p-3">Courier</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Estimated Delivery</th>
                <th className="text-left p-3">Last Updated</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-mono">
                    #{String(row.orderId || row.id).slice(-6)}
                  </td>
                  <td className="p-3">{row.customer || "Customer"}</td>
                  <td className="p-3">{row.awb || "-"}</td>
                  <td className="p-3">{row.courier || "-"}</td>
                  <td className="p-3">
                    <div className="font-semibold uppercase">{row.status || "pending"}</div>
                    {String(row.status).toLowerCase() === "failed" && row.error ? (
                      <div className="mt-1 max-w-xs text-xs text-red-600 normal-case">
                        {row.error}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">{formatDate(row.estimatedDelivery)}</td>
                  <td className="p-3">{formatDateTime(row.updatedAt)}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-gray-400">
                    No shipments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
