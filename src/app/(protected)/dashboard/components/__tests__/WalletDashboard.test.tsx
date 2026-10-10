import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetBalance, BalanceState } from "@/features/wallet/presentation/hooks/useWalletBalance";
import { WalletDashboard } from "../WalletDashboard";

const wallet = vi.hoisted(() => ({
    useWalletBalance: vi.fn(),
    refetch: vi.fn(),
}));

vi.mock("@/features/wallet", () => ({
    useWallet: () => ({ publicKey: "test-wallet" }),
    useWalletBalance: wallet.useWalletBalance,
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
}));

// These unrelated dialogs are not opened in the balance regression tests.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

function asset(code: string | null, balance: string): AssetBalance {
    return {
        asset_type: code === null ? "native" : "credit_alphanum4",
        asset_code: code,
        asset_issuer: null,
        balance,
    };
}

function setBalance(balances: AssetBalance[], overrides: Partial<BalanceState> = {}) {
    wallet.useWalletBalance.mockReturnValue({
        balance: null,
        balances,
        isLoading: false,
        error: null,
        refetch: wallet.refetch,
        ...overrides,
    });
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("WalletDashboard balance disclosure", () => {
    it.each([
        { name: "a mixed portfolio", balances: [asset("USDC", "25.50"), asset(null, "10")], total: "25.50", count: 1 },
        { name: "only unpriced holdings", balances: [asset(null, "10"), asset("TOKEN", "2")], total: "0.00", count: 2 },
        { name: "a tiny unpriced holding", balances: [asset(null, "0.0000001")], total: "0.00", count: 1 },
    ])("threads the real mapper count through the hook for $name", ({ balances, total, count }) => {
        setBalance(balances);
        render(<WalletDashboard />);

        const card = within(screen.getByRole("region", { name: "Partial balance" }));
        expect(card.getByText(total)).toBeTruthy();
        expect(card.getByText(new RegExp(`^${count} assets? (is|are) excluded`))).toBeTruthy();
        expect(wallet.useWalletBalance).toHaveBeenCalledWith("test-wallet");
        expect(screen.getAllByTestId("wallet-asset-row").length).toBeGreaterThan(0);
    });

    it.each([
        { name: "an empty portfolio", balances: [], total: "0.00" },
        { name: "zero unpriced balances", balances: [asset(null, "0"), asset("TOKEN", "0"), asset("USDC", "3")], total: "3.00" },
        { name: "an inserted zero-balance XLM row", balances: [asset("USDC", "25"), asset("USDT", "5")], total: "30.00" },
    ])("does not disclose excluded holdings for $name", ({ balances, total }) => {
        setBalance(balances);
        render(<WalletDashboard />);

        const card = within(screen.getByRole("region", { name: "Total balance" }));
        expect(card.getByText(total)).toBeTruthy();
        expect(card.queryByText(/excluded from this total/)).toBeNull();
    });

    it("refreshes the disclosure through loading, error, retry, and recovery", () => {
        const unpriced = [asset(null, "10")];
        setBalance(unpriced);
        const { rerender } = render(<WalletDashboard />);
        expect(screen.getByText(/1 asset is excluded/)).toBeTruthy();

        setBalance(unpriced, { isLoading: true });
        rerender(<WalletDashboard />);
        expect(screen.getByRole("status", { name: "Loading total balance" })).toBeTruthy();
        expect(screen.queryByText(/excluded from this total/)).toBeNull();

        setBalance(unpriced, { error: "Offline" });
        rerender(<WalletDashboard />);
        const card = within(screen.getByRole("region", { name: "Total balance" }));
        expect(card.getByRole("alert").textContent).toContain("Offline");
        expect(card.queryByText(/excluded from this total/)).toBeNull();
        fireEvent.click(card.getByRole("button", { name: "Retry" }));
        expect(wallet.refetch).toHaveBeenCalledTimes(1);

        setBalance(unpriced);
        rerender(<WalletDashboard />);
        expect(screen.getByText(/1 asset is excluded/)).toBeTruthy();

        setBalance([asset("USDC", "10")]);
        rerender(<WalletDashboard />);
        expect(screen.getByRole("region", { name: "Total balance" })).toBeTruthy();
        expect(screen.queryByText(/excluded from this total/)).toBeNull();
    });
});
