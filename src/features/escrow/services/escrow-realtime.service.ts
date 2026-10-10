import { io, Socket } from "socket.io-client";
/** Typed socket for escrow real-time events. */
export type EscrowSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Server → Client events emitted by the backend for escrow status sync.
 *
 * The event name `escrow-status-updated` and its payload shape must match
 * the backend contract from the "Implement On-Chain Escrow Status
 * Synchronization" issue.
 */
interface ServerToClientEvents {
    /** Payload remains unknown until decoded at the consumer boundary. */
    "escrow-status-updated": (event: unknown) => void;
    "escrow-error": (error: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
    "subscribe-order": (
        payload: { orderId: string },
        ack?: (response: { ok: boolean; error?: string }) => void,
    ) => void;
    "unsubscribe-order": (
        payload: { orderId: string },
        ack?: (response: { ok: boolean }) => void,
    ) => void;
}

/**
 * Creates a socket.io connection to the backend for escrow real-time updates.
 *
 * The socket is created with `autoConnect: false` so the caller controls
 * when the connection is established.
 *
 * Returns `null` when `NEXT_PUBLIC_API_URL` is not configured so the
 * caller can fall through to polling.
 */
export function createEscrowSocket(accessToken: string): EscrowSocket | null {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;

    return io(apiUrl.replace(/\/$/, ""), {
        auth: { token: accessToken },
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5_000,
    });
}
