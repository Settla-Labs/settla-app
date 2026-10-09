import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WalletDashboard } from "../WalletDashboard";

const wallet = vi.hoisted(() => ({
    balances: [] as Array<{ asset_type: string; asset_code: string | null; asset_issuer: string | null; balance: string }>,
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
}));

vi.mock("@/features/wallet", () => ({
    useWallet: () => ({ publicKey: "dummy-test-key" }),
    useWalletBalance: () => wallet,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

afterEach(cleanup);
beforeEach(() => {
    wallet.balances = [];
    wallet.isLoading = false;
    wallet.error = null;
});

const usd = { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "dummy-issuer", balance: "100" };
const xlm = { asset_type: "native", asset_code: null, asset_issuer: null, balance: "25" };

describe("WalletDashboard real balance mapping", () => {
    it("threads the excluded count from the real hook and mapper into the card", () => {
        wallet.balances = [usd, xlm];
        render(<WalletDashboard />);
        expect(screen.getByText("Priced Assets Total")).toBeTruthy();
        expect(screen.getByText("Excludes 1 held asset with no USD price.")).toBeTruthy();
        expect(screen.getByText("Stellar Lumens")).toBeTruthy();
        expect(screen.getByText("25.00")).toBeTruthy();
    });

    it("does not count the zero-balance XLM baseline as an excluded holding", () => {
        wallet.balances = [usd];
        render(<WalletDashboard />);
        expect(screen.getByText("Total Balance")).toBeTruthy();
        expect(screen.queryByText(/Excludes/)).toBeNull();
    });

    it("does not present an all-unpriced portfolio as an unexplained zero total", () => {
        wallet.balances = [xlm];
        render(<WalletDashboard />);
        expect(screen.getByText("Priced Assets Total")).toBeTruthy();
        expect(screen.getByText("Excludes 1 held asset with no USD price.")).toBeTruthy();
    });

    it("hides stale exclusions during loading and failure, then shows the recovered total", () => {
        wallet.balances = [usd, xlm];
        wallet.isLoading = true;
        const { rerender } = render(<WalletDashboard />);
        expect(screen.getByRole("status", { name: "Loading total balance" })).toBeTruthy();
        expect(screen.queryByText(/Excludes/)).toBeNull();
        wallet.isLoading = false;
        wallet.error = "Offline";
        rerender(<WalletDashboard />);
        expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
        expect(screen.queryByText(/Excludes/)).toBeNull();
        wallet.error = null;
        rerender(<WalletDashboard />);
        expect(screen.getByText("Excludes 1 held asset with no USD price.")).toBeTruthy();
    });
});
