import { describe, expect, it } from "vitest";
import { resolvePaymentDetails } from "../payment-details";

describe("resolvePaymentDetails", () => {
    it("returns verified payment details only when every required field is present", () => {
        expect(resolvePaymentDetails({
            bankName: "Fictional Bank",
            accountIdentifier: "DE123",
            beneficiaryName: "Alice Seller",
        })).toEqual({
            available: true,
            label: "Fictional Bank",
            accountIdentifier: "DE123",
            accountOwner: "Alice Seller",
        });
    });

    it("uses an explicit unavailable state instead of demo payment data", () => {
        expect(resolvePaymentDetails()).toEqual({
            available: false,
            label: "Payment details unavailable",
            accountIdentifier: "No details provided",
            accountOwner: "Payment details unavailable",
        });
    });

    it("treats partial or blank details as unavailable", () => {
        expect(resolvePaymentDetails({
            bankName: "  ",
            accountDetails: "DE123",
            beneficiary_name: "Alice Seller",
        }).available).toBe(false);
    });
});
