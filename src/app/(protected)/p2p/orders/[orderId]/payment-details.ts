import type { PaymentMethodOption } from "@/features/paymentMethod/models/paymentMethod";

export interface ResolvedPaymentDetails {
    available: boolean;
    label: string;
    accountIdentifier: string;
    accountOwner: string;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

export function resolvePaymentDetails(paymentMethod?: PaymentMethodOption): ResolvedPaymentDetails {
    const label = firstNonEmpty(paymentMethod?.payment_provider?.name, paymentMethod?.bankName);
    const accountIdentifier = firstNonEmpty(
        paymentMethod?.accountIdentifier,
        paymentMethod?.account_identifier,
        paymentMethod?.accountDetails,
    );
    const accountOwner = firstNonEmpty(
        paymentMethod?.beneficiaryName,
        paymentMethod?.beneficiary_name,
    );

    return {
        available: Boolean(paymentMethod && label && accountIdentifier && accountOwner),
        label: label ?? "Payment details unavailable",
        accountIdentifier: accountIdentifier ?? "No details provided",
        accountOwner: accountOwner ?? "Payment details unavailable",
    };
}
