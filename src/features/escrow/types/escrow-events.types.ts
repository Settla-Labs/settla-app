/**
 * Escrow statuses as they come from the backend.
 * Must stay in sync with the backend enum and with EscrowOnChain.escrowStatus
 * in src/features/order/models/order.ts.
 */
export type EscrowStatus =
    | "pending"
    | "initialized"
    | "funded"
    | "fiat_sent"
    | "released"
    | "disputed"
    | "resolved";

/**
 * Payload emitted by the backend over WebSocket when an escrow status changes.
 * Event name: `escrow-status-updated`
 */
export interface EscrowStatusEvent {
    orderId: string;
    escrowId: string;
    status: EscrowStatus;
    transactionHash?: string;
    updatedAt: string;
    /** Unique event identifier used for deduplication. */
    eventId?: string;
}

const ESCROW_STATUSES: ReadonlySet<string> = new Set([
    "pending",
    "initialized",
    "funded",
    "fiat_sent",
    "released",
    "disputed",
    "resolved",
]);

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Decodes an escrow status event received across an untrusted wire boundary.
 * A fresh object is returned so callers never retain arbitrary payload fields.
 */
export function decodeEscrowStatusEvent(
    payload: unknown,
): EscrowStatusEvent | null {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return null;
    }

    const candidate = payload as Record<string, unknown>;
    if (
        !isNonEmptyString(candidate.orderId) ||
        !isNonEmptyString(candidate.escrowId) ||
        !isNonEmptyString(candidate.updatedAt) ||
        !isNonEmptyString(candidate.status) ||
        !ESCROW_STATUSES.has(candidate.status) ||
        (candidate.transactionHash !== undefined &&
            !isNonEmptyString(candidate.transactionHash)) ||
        (candidate.eventId !== undefined && !isNonEmptyString(candidate.eventId))
    ) {
        return null;
    }

    return {
        orderId: candidate.orderId,
        escrowId: candidate.escrowId,
        status: candidate.status as EscrowStatus,
        updatedAt: candidate.updatedAt,
        ...(candidate.transactionHash !== undefined
            ? { transactionHash: candidate.transactionHash }
            : {}),
        ...(candidate.eventId !== undefined
            ? { eventId: candidate.eventId }
            : {}),
    };
}

/** Connection / sync status surfaced to the UI. */
export type EscrowSyncStatus =
    | "idle"
    | "syncing"
    | "synchronized"
    | "polling"
    | "reconnecting"
    | "error";

export interface EscrowSyncState {
    status: EscrowSyncStatus;
    lastUpdated: string | null;
    /** Whether the sync is driven by a WebSocket connection or polling. */
    source: "websocket" | "polling" | null;
}
