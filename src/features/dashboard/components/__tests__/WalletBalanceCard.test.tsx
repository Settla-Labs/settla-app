import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletBalanceCard } from "../WalletBalanceCard";

afterEach(cleanup);

describe("WalletBalanceCard", () => {
    const props = { totalBalance: "125.50", currency: "USD", unpricedAssetCount: 0 };

    it("shows the total without a disclosure when all held assets are priced", () => {
        render(<WalletBalanceCard {...props} />);

        expect(screen.getByRole("region", { name: "Total balance" })).toBeTruthy();
        expect(screen.getByText("125.50")).toBeTruthy();
        expect(screen.getByText("USD")).toBeTruthy();
        expect(screen.queryByText(/excluded from this total/)).toBeNull();
    });

    it.each([
        [1, "1 asset is"],
        [2, "2 assets are"],
    ])("discloses %i unpriced held assets", (unpricedAssetCount, countLabel) => {
        render(<WalletBalanceCard {...props} unpricedAssetCount={unpricedAssetCount} />);

        expect(screen.getByRole("region", { name: "Partial balance" })).toBeTruthy();
        expect(screen.getByText("Partial Balance")).toBeTruthy();
        expect(screen.getByText(`${countLabel} excluded from this total because a USD price is unavailable.`)).toBeTruthy();
        expect(screen.getByText("125.50")).toBeTruthy();
    });

    it("discloses an entirely unpriced portfolio even when the total is zero", () => {
        render(<WalletBalanceCard {...props} totalBalance="0.00" unpricedAssetCount={1} />);

        expect(screen.getByText("0.00")).toBeTruthy();
        expect(screen.getByText("Partial Balance")).toBeTruthy();
        expect(screen.getByText(/1 asset is excluded/)).toBeTruthy();
    });

    it("uses the displayed currency in the disclosure", () => {
        render(<WalletBalanceCard {...props} currency="EUR" unpricedAssetCount={1} />);

        expect(screen.getByText(/a EUR price is unavailable/)).toBeTruthy();
    });

    it("hides a stale partial balance while loading, including when an error remains", () => {
        render(<WalletBalanceCard {...props} unpricedAssetCount={1} isLoading error="Offline" />);

        expect(screen.getByRole("status", { name: "Loading total balance" })).toBeTruthy();
        expect(screen.getByText("Total Balance")).toBeTruthy();
        expect(screen.queryByText("125.50")).toBeNull();
        expect(screen.queryByText(/excluded from this total/)).toBeNull();
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("hides stale valuation in the error state and preserves retry and actions", () => {
        const onRetry = vi.fn();
        render(
            <WalletBalanceCard
                {...props}
                unpricedAssetCount={1}
                error="Offline"
                onRetry={onRetry}
                actions={<button type="button">Receive</button>}
            />,
        );

        expect(screen.getByRole("alert").textContent).toContain("Offline");
        expect(screen.getByRole("region", { name: "Total balance" })).toBeTruthy();
        expect(screen.queryByText("125.50")).toBeNull();
        expect(screen.queryByText(/excluded from this total/)).toBeNull();
        expect(screen.getByRole("button", { name: "Receive" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
