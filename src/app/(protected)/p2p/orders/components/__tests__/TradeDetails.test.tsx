import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TradeDetails, type TradeDetailsProps } from "../TradeDetails";

const buyerTrade: TradeDetailsProps = {
    role: "buyer",
    amount: 10,
    assetCode: "USDC",
    unitPrice: 1,
    total: 10,
    paymentMethod: "Bank transfer",
    accountIdentifier: "DE123",
    accountOwner: "Alice",
    counterpartyName: "Alice",
};

describe("TradeDetails counterparty trust information", () => {
    it("shows verified status without inventing a completion rate", () => {
        render(<TradeDetails {...buyerTrade} counterpartyKyc />);

        expect(screen.getByText("Verified Merchant")).toBeTruthy();
        expect(screen.queryByText(/completion/i)).toBeNull();
        expect(screen.queryByText(/\d+(?:\.\d+)?%/)).toBeNull();
    });

    it("does not claim verified status for an unverified counterparty", () => {
        render(<TradeDetails {...buyerTrade} counterpartyKyc={false} />);

        expect(screen.queryByText("Verified Merchant")).toBeNull();
        expect(screen.queryByText(/completion/i)).toBeNull();
    });
});
