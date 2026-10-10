import { describe, expect, it } from "vitest";
import { decodeEscrowStatusEvent } from "../escrow-events.types";

const validEvent = {
    orderId: "order-1",
    escrowId: "escrow-1",
    status: "funded",
    transactionHash: "tx-1",
    updatedAt: "2026-10-09T10:30:00.000Z",
    eventId: "event-1",
};

describe("decodeEscrowStatusEvent", () => {
    it("returns a validated copy of a known event", () => {
        expect(
            decodeEscrowStatusEvent({ ...validEvent, ignored: "wire-only" }),
        ).toEqual(validEvent);
    });

    it.each(["pending", "initialized", "funded", "fiat_sent", "released", "disputed", "resolved"])(
        "accepts the %s status",
        (status) => {
            expect(decodeEscrowStatusEvent({ ...validEvent, status })).not.toBeNull();
        },
    );

    it.each([
        null,
        [],
        "event",
        { ...validEvent, orderId: "" },
        { ...validEvent, escrowId: undefined },
        { ...validEvent, updatedAt: undefined },
        { ...validEvent, status: "settled" },
        { ...validEvent, eventId: 42 },
        { ...validEvent, transactionHash: null },
    ])("rejects malformed payload %#", (payload) => {
        expect(decodeEscrowStatusEvent(payload)).toBeNull();
    });
});
