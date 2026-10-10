import { io, type Socket } from "socket.io-client";

/**
 * Creates a manually connected authenticated socket using the shared
 * websocket/reconnection policy. A missing or blank URL disables realtime
 * transport; callers may continue with their existing non-socket behavior.
 */
export function createAuthedSocket(
    url: string | undefined,
    token: string,
): Socket | null {
    const normalizedUrl = url?.trim().replace(/\/+$/, "");
    if (!normalizedUrl) return null;

    return io(normalizedUrl, {
        auth: { token },
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
    });
}
