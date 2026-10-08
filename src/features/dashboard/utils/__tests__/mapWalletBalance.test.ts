import { describe, expect, it } from "vitest";
import type { AssetBalance } from "@/features/wallet";
import { mapWalletBalance } from "../mapWalletBalance";

function asset(code: string | null, balance: string): AssetBalance {
    return {
        asset_type: code === "XLM" ? "native" : "credit_alphanum4",
        asset_code: code === "XLM" ? null : code,
        asset_issuer: code === "XLM" ? null : "test-issuer",
        balance,
    };
}

describe("mapWalletBalance", () => {
    it.each([undefined, null, []])("keeps an empty portfolio empty (%j)", (input) => {
        expect(mapWalletBalance(input)).toEqual({
            totalBalance: "0.00",
            currency: "USD",
            assets: [],
            unpricedAssetCount: 0,
        });
    });

    it.each(["not-a-number", "Infinity", "-Infinity"])(
        "coerces a non-finite balance to zero (%s)",
        (balance) => {
            const result = mapWalletBalance([asset("USDC", balance)], {
                includeBaselineAssets: false,
            });
            expect(result.totalBalance).toBe("0.00");
            expect(result.assets[0]).toMatchObject({ rawBalance: 0, balance: "0.00" });
            expect(result.unpricedAssetCount).toBe(0);
        },
    );

    it("counts positive unpriced assets without adding them to the total", () => {
        const result = mapWalletBalance([
            asset("USDC", "12.5"),
            asset("DAI", "80"),
        ]);
        expect(result.totalBalance).toBe("12.50");
        expect(result.unpricedAssetCount).toBe(1);
        expect(result.assets.find((item) => item.code === "DAI")).toEqual({
            code: "DAI", name: "DAI", icon: undefined, balance: "80.00",
            rawBalance: 80, issuer: "test-issuer", isPriced: false,
        });
    });

    it("adds missing baseline assets in XLM/USDC order before other assets", () => {
        const result = mapWalletBalance([asset("USDT", "5")]);
        expect(result.assets.map((item) => item.code)).toEqual(["XLM", "USDC", "USDT"]);
        expect(result.assets.slice(0, 2)).toEqual([
            { code: "XLM", name: "Stellar Lumens", icon: "/xlm.png", balance: "0.00", rawBalance: 0, issuer: null, isPriced: false },
            { code: "USDC", name: "USD Coin", icon: "/usdc.png", balance: "0.00", rawBalance: 0, issuer: null, isPriced: true },
        ]);
        expect(result.totalBalance).toBe("5.00");
        expect(result.unpricedAssetCount).toBe(0);
    });

    it("sorts existing baseline assets without duplicating their balances", () => {
        const result = mapWalletBalance([asset("USDC", "3"), asset("XLM", "4")]);
        expect(result.assets.map((item) => [item.code, item.rawBalance])).toEqual([
            ["XLM", 4], ["USDC", 3],
        ]);
        expect(result.unpricedAssetCount).toBe(1);
    });

    it("opts out of baseline additions and sorting", () => {
        const result = mapWalletBalance([asset("USDT", "2"), asset("XLM", "3")], {
            includeBaselineAssets: false,
        });
        expect(result.assets.map((item) => item.code)).toEqual(["USDT", "XLM"]);
        expect(result.totalBalance).toBe("2.00");
    });

    it("uses supplied rates and currency, retaining zero as a valid rate", () => {
        const result = mapWalletBalance([asset("XLM", "2"), asset("USDC", "10")], {
            rates: { XLM: 0.25, USDC: 0 }, currency: "EUR",
        });
        expect(result.currency).toBe("EUR");
        expect(result.totalBalance).toBe("0.50");
        expect(result.assets.every((item) => item.isPriced)).toBe(true);
        expect(result.unpricedAssetCount).toBe(0);
    });

    it("labels a missing code UNKNOWN and excludes nonpositive unpriced holdings from the count", () => {
        const result = mapWalletBalance([asset(null, "0"), asset("OTHER", "-2")], {
            includeBaselineAssets: false,
        });
        expect(result.assets[0]).toMatchObject({ code: "UNKNOWN", name: "UNKNOWN", isPriced: false });
        expect(result.totalBalance).toBe("0.00");
        expect(result.unpricedAssetCount).toBe(0);
    });

    it("truncates display amounts to four decimals and groups thousands", () => {
        const result = mapWalletBalance([asset("USDC", "1234.56789")], {
            includeBaselineAssets: false,
        });
        expect(result.assets[0].rawBalance).toBe(1234.56789);
        expect(result.assets[0].balance).toBe("1,234.5678");
        expect(result.totalBalance).toBe("1,234.5678");
    });
});
