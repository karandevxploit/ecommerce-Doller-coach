import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuthStore } from "../store";

const SOCKET_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8001";

/**
 * useRealtime
 * Stable real-time connection with safe lifecycle + auth sync
 */
export const useRealtime = ({ isAdmin = false } = {}) => {
    const { token } = useAuthStore();

    const socketRef = useRef(null);
    const [telemetry, setTelemetry] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    /* ---------------- INIT SOCKET ---------------- */
    useEffect(() => {
        if (!token) {
            socketRef.current?.disconnect();
            socketRef.current = null;
            setIsConnected(false);
            return;
        }

        // prevent duplicate instances
        if (socketRef.current) return;

        const baseUrl = SOCKET_URL.replace(/\/api$/, "");

        const socket = io(baseUrl, {
            auth: { token },
            query: { admin: isAdmin },
            withCredentials: true,
            transports: ["websocket"],
            reconnectionAttempts: 5,
            reconnectionDelay: 1500,
            timeout: 5000
        });

        socketRef.current = socket;

        /* ---------------- EVENTS ---------------- */
        const handleConnect = () => {
            setIsConnected(true);
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        const handleError = () => {
            setIsConnected(false);
        };

        const handleTelemetry = (data) => {
            if (data) setTelemetry(data);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleError);
        socket.on("telemetry_update", handleTelemetry);
        socket.on("admin:update", handleTelemetry);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleError);
            socket.off("telemetry_update", handleTelemetry);
            socket.off("admin:update", handleTelemetry);
        };
    }, [token, isAdmin]);

    /* ---------------- VISIBILITY HANDLING ---------------- */
    useEffect(() => {
        const handleVisibility = () => {
            const socket = socketRef.current;
            if (!socket) return;

            if (document.visibilityState === "visible" && !socket.connected) {
                socket.connect();
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);

        return () =>
            document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    return {
        telemetry,
        isConnected,
        socket: socketRef.current
    };
};