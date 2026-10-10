import { describe, expect, it } from "vitest";
import type { AssetBalance } from "@/features/wallet";
import { mapWalletBalance } from "./mapWalletBalance";

function balance(value: string): AssetBalance {
    return {
        asset_type: "native",
        asset_code: null,
        asset_issuer: null,
        balance: value,
    };
}

describe("mapWalletBalance", () => {
    it("rounds a display value up instead of understating it", () => {
        const result = mapWalletBalance([balance("0.00009999")], {
            includeBaselineAssets: false,
        });

        expect(result.assets[0].rawBalance).toBe(0.00009999);
        expect(result.assets[0].balance).toBe(
            (0.0001).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
            }),
        );
    });

    it("rounds totals to the same display precision", () => {
        const result = mapWalletBalance([balance("1.23456")], {
            includeBaselineAssets: false,
            rates: { XLM: 1 },
        });

        expect(result.totalBalance).toBe(
            (1.2346).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
            }),
        );
    });
});
