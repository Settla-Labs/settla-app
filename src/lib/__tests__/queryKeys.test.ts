import { describe, expect, it } from "vitest";
import { queryKeys } from "../queryKeys";

describe("queryKeys", () => {
    it("keeps every payment-method key under the shared prefix", () => {
        const prefix = queryKeys.paymentMethods.all[0];
        const paymentMethodKeys = [
            queryKeys.paymentMethods.all,
            queryKeys.paymentMethods.detail("method-123"),
            queryKeys.paymentMethods.providers,
        ];

        for (const key of paymentMethodKeys) {
            expect(key[0]).toBe(prefix);
        }
    });

    it("gives providers a stable child key without colliding with the list", () => {
        expect(queryKeys.paymentMethods.providers).toEqual([
            "paymentMethods",
            "providers",
        ]);
        expect(queryKeys.paymentMethods.providers).not.toEqual(
            queryKeys.paymentMethods.all,
        );
    });
});
