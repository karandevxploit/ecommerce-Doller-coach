import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

/**
 * Hook to consume real-time telemetry from the backend.
 * Automatically handles admin room subscription.
 */
export const useRealtime = (isAdmin = false) => {
    const [telemetry, setTelemetry] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        // Build base URL (strip /api if present)
        const baseUrl = SOCKET_URL.replace(/\/api$/, "");
        
        const socket = io(baseUrl, {
            query: { admin: isAdmin },
            withCredentials: true,
            reconnectionAttempts: 5,
            timeout: 10000
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setIsConnected(true);
            console.log("[SOCKET] Connected to telemetry node");
        });

        socket.on("disconnect", () => {
            setIsConnected(false);
            setTelemetry(null);
        });

        socket.on("telemetry_update", (data) => {
            setTelemetry(data);
        });

        return () => {
            socket.disconnect();
        };
    }, [isAdmin]);

    return { telemetry, isConnected };
};
