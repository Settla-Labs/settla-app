import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EvidencePreview } from "../EvidencePreview";

const releaseEscrow = vi.fn();

vi.mock("@/features/escrow/hooks/useEscrows", () => ({
    useEscrows: () => ({
        fundEscrow: vi.fn(),
        releaseEscrow,
        syncEscrow: vi.fn(),
    }),
}));

vi.mock("@/features/order/hooks/useOrders", () => ({
    useOrders: () => ({ updateOrder: vi.fn() }),
}));

vi.mock("@/features/wallet/application/wallet.service", () => ({
    isSignatureCancelled: () => false,
}));

vi.mock("@/features/wallet/hooks/useSignatureCancellation", () => ({
    useSignatureCancellation: () => ({
        sign: vi.fn(),
        retry: vi.fn(),
        cancel: vi.fn(),
        showModal: false,
    }),
}));

vi.mock("@/features/notifications", () => ({
    useNotifications: () => ({ notify: vi.fn() }),
}));

function renderPreview(paymentDetailsAvailable: boolean) {
    return render(
        <EvidencePreview
            orderId="order-1"
            escrowId="escrow-1"
            escrowStatus="fiat_sent"
            sellerAddress="GSELLER"
            amount={10}
            evidenceUrl="https://example.test/receipt.png"
            onStatusChange={vi.fn()}
            canCancel={false}
            isCancelling={false}
            onCancelOrder={vi.fn()}
            paymentDetailsAvailable={paymentDetailsAvailable}
        />,
    );
}

describe("EvidencePreview payment-details release guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("blocks release when verified payment details are missing", () => {
        renderPreview(false);

        const releaseButton = screen.getByRole("button", { name: "PAYMENT DETAILS REQUIRED" }) as HTMLButtonElement;
        expect(releaseButton.disabled).toBe(true);
        expect(screen.getByRole("alert").textContent).toContain("Crypto release is disabled");

        fireEvent.click(releaseButton);
        expect(releaseEscrow).not.toHaveBeenCalled();
    });

    it("keeps the release action available when payment details are complete", () => {
        renderPreview(true);

        const releaseButton = screen.getByRole("button", { name: "RELEASE CRYPTO" }) as HTMLButtonElement;
        expect(releaseButton.disabled).toBe(false);
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
