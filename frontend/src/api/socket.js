import { io } from "socket.io-client";
import { getAccessToken } from "../api/client";

// ======================
// BASE URL (SAFE)
// ======================
const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
    : "http://localhost:8001";

// ======================
// SOCKET INSTANCE
// ======================
const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    timeout: 5000,

    // ✅ Always use websocket first (faster)
    transports: ["websocket"],

    // ✅ Attach token dynamically
    auth: {
        token: getAccessToken(),
    },

    withCredentials: true,
});

// ======================
// SAFE CONNECT FUNCTION
// ======================
export const connectSocket = () => {
    if (socket.connected) return;

    // 🔄 update token before connect
    socket.auth = {
        token: getAccessToken(),
    };

    socket.connect();
};

// ======================
// SAFE DISCONNECT
// ======================
export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

// ======================
// EVENTS
// ======================
socket.on("connect", () => {
    console.log("[SOCKET] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
    console.log("[SOCKET] Disconnected:", reason);
});

// ❌ Better error handling
socket.on("connect_error", (err) => {
    console.warn("[SOCKET_ERROR]", err.message);

    // ❌ Stop reconnect on auth error
    if (err.message === "Unauthorized") {
        console.error("[SOCKET] Auth failed → disconnecting");
        socket.disconnect();
    }
});

// ======================
// CLEANUP SAFETY
// ======================
export const resetSocket = () => {
    socket.removeAllListeners();
    socket.disconnect();
};

// ======================
export default socket;