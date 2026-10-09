import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WalletBalanceCard } from "../WalletBalanceCard";

afterEach(cleanup);

describe("WalletBalanceCard pricing disclosure", () => {
    it("keeps the complete total when every held asset is priced", () => {
        render(<WalletBalanceCard totalBalance="123.45" currency="USD" />);
        expect(screen.getByText("Total Balance")).toBeTruthy();
        expect(screen.getByText("123.45")).toBeTruthy();
        expect(screen.queryByText(/Excludes/)).toBeNull();
    });

    it("identifies a partial total and the excluded held asset", () => {
        render(<WalletBalanceCard totalBalance="123.45" currency="USD" unpricedAssetCount={1} />);
        expect(screen.getByText("Priced Assets Total")).toBeTruthy();
        expect(screen.getByText("123.45")).toBeTruthy();
        expect(screen.getByText("Excludes 1 held asset with no USD price.")).toBeTruthy();
    });

    it("uses the actual currency and plural count", () => {
        render(<WalletBalanceCard totalBalance="10.00" currency="SEK" unpricedAssetCount={2} />);
        expect(screen.getByText("Excludes 2 held assets with no SEK price.")).toBeTruthy();
    });

    it("discloses exclusions even when the priced total is zero", () => {
        render(<WalletBalanceCard totalBalance="0.00" currency="USD" unpricedAssetCount={1} />);
        expect(screen.getByText("0.00")).toBeTruthy();
        expect(screen.getByText("Priced Assets Total")).toBeTruthy();
        expect(screen.getByText(/Excludes 1 held asset/)).toBeTruthy();
    });

    it("does not disclose a stale partial total while loading", () => {
        render(<WalletBalanceCard totalBalance="123.45" currency="USD" unpricedAssetCount={2} isLoading />);
        expect(screen.getByRole("status", { name: "Loading total balance" })).toBeTruthy();
        expect(screen.queryByText("123.45")).toBeNull();
        expect(screen.queryByText("Priced Assets Total")).toBeNull();
        expect(screen.queryByText(/Excludes/)).toBeNull();
    });

    it("keeps the error and retry flow without a stale disclosure", () => {
        const retry = vi.fn();
        render(<WalletBalanceCard totalBalance="123.45" currency="USD" unpricedAssetCount={2} error="Offline" onRetry={retry} />);
        expect(screen.getByRole("alert").textContent).toContain("Offline");
        expect(screen.queryByText("123.45")).toBeNull();
        expect(screen.queryByText("Priced Assets Total")).toBeNull();
        expect(screen.queryByText(/Excludes/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it("removes the disclosure when a refreshed portfolio is fully priced", () => {
        const { rerender } = render(<WalletBalanceCard totalBalance="1.00" currency="USD" unpricedAssetCount={1} />);
        expect(screen.getByText(/Excludes/)).toBeTruthy();
        rerender(<WalletBalanceCard totalBalance="2.00" currency="USD" unpricedAssetCount={0} />);
        expect(screen.getByText("Total Balance")).toBeTruthy();
        expect(screen.getByText("2.00")).toBeTruthy();
        expect(screen.queryByText(/Excludes/)).toBeNull();
    });
});
