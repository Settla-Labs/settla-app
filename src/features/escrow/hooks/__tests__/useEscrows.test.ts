import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useEscrows } from "../useEscrows";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const openParams = {
    orderId: "dummy-order",
    sellerAddress: "dummy-seller",
    buyerAddress: "dummy-buyer",
    amount: 12.5,
    title: "Dummy escrow",
    assetCode: "USDC",
};
const fundParams = {
    escrowId: "dummy-escrow",
    signerAddress: "dummy-seller",
    amount: 12.5,
};
const syncParams = {
    escrowId: "dummy-escrow",
    action: "fund" as const,
    signedXdr: "dummy-signed-xdr",
};
const fiatParams = {
    buyerAddress: "dummy-buyer",
    evidence: "dummy-evidence",
};
const releaseParams = {
    escrowId: "dummy-escrow",
    releaseSigner: "dummy-seller",
};

type Escrows = ReturnType<typeof useEscrows>;

const jsonMutations = [
    {
        name: "openEscrow",
        path: "/escrows/open",
        body: openParams,
        invoke: (hook: Escrows) => hook.openEscrow(openParams),
    },
    {
        name: "fundEscrow",
        path: "/escrows/fund",
        body: fundParams,
        invoke: (hook: Escrows) => hook.fundEscrow(fundParams),
    },
    {
        name: "syncEscrow",
        path: "/escrows/sync",
        body: syncParams,
        invoke: (hook: Escrows) => hook.syncEscrow(syncParams),
    },
    {
        name: "markFiatSent",
        path: "/escrows/dummy-escrow/fiat-sent",
        body: fiatParams,
        invoke: (hook: Escrows) => hook.markFiatSent("dummy-escrow", fiatParams),
    },
    {
        name: "releaseEscrow",
        path: "/escrows/release",
        body: releaseParams,
        invoke: (hook: Escrows) => hook.releaseEscrow(releaseParams),
    },
];

describe("useEscrows", () => {
    let client: QueryClient;
    const orderDetailKey = queryKeys.orders.detail("dummy-order");

    beforeEach(() => {
        vi.mocked(apiFetch).mockReset();
        client = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: Infinity },
                mutations: { retry: false, gcTime: Infinity },
            },
        });
        client.setQueryData(queryKeys.orders.all, [{ id: "dummy-order" }]);
        client.setQueryData(orderDetailKey, { id: "dummy-order" });
        client.setQueryData(queryKeys.offers.all, [{ id: "dummy-offer" }]);
        vi.spyOn(client, "invalidateQueries");
    });

    afterEach(() => {
        cleanup();
        client.clear();
        vi.restoreAllMocks();
    });

    function renderEscrows() {
        return renderHook(useEscrows, {
            wrapper: ({ children }: { children: ReactNode }) =>
                createElement(QueryClientProvider, { client }, children),
        });
    }

    function expectOrdersInvalidated() {
        expect(client.invalidateQueries).toHaveBeenCalledExactlyOnceWith({
            queryKey: queryKeys.orders.all,
        });
        expect(client.getQueryState(queryKeys.orders.all)?.isInvalidated).toBe(true);
        expect(client.getQueryState(orderDetailKey)?.isInvalidated).toBe(true);
        expect(client.getQueryState(queryKeys.offers.all)?.isInvalidated).toBe(false);
    }

    function expectOrdersUnchanged() {
        expect(client.invalidateQueries).not.toHaveBeenCalled();
        expect(client.getQueryState(queryKeys.orders.all)?.isInvalidated).toBe(false);
        expect(client.getQueryState(orderDetailKey)?.isInvalidated).toBe(false);
    }

    it.each(jsonMutations)("$name posts the exact request and invalidates orders on success", async ({ path, body, invoke }) => {
        const response = { unsignedTransaction: "dummy-unsigned-xdr" };
        vi.mocked(apiFetch).mockResolvedValueOnce(response);
        const { result } = renderEscrows();
        let returned: unknown;

        await act(async () => { returned = await invoke(result.current); });

        expect(apiFetch).toHaveBeenCalledExactlyOnceWith(path, { method: "POST", body });
        expect(returned).toBe(response);
        expectOrdersInvalidated();
    });

    it("uploadEvidence sends the supplied file as FormData and invalidates orders", async () => {
        const file = new File(["dummy evidence"], "dummy-evidence.txt", { type: "text/plain" });
        const response = { url: "https://evidence.invalid/dummy-evidence.txt" };
        vi.mocked(apiFetch).mockResolvedValueOnce(response);
        const { result } = renderEscrows();
        let returned: unknown;

        await act(async () => { returned = await result.current.uploadEvidence("dummy-escrow", file); });

        expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/escrows/dummy-escrow/evidence", {
            method: "POST",
            body: expect.any(FormData),
        });
        const formData = vi.mocked(apiFetch).mock.calls[0][1]?.body as FormData;
        expect(Array.from(formData.keys())).toEqual(["file"]);
        expect(formData.get("file")).toBe(file);
        expect(returned).toBe(response);
        expectOrdersInvalidated();
    });

    it.each(["initialize", "fiat_sent", "release"] as const)("syncEscrow preserves the %s action and signed XDR", async (action) => {
        const params = { ...syncParams, action };
        vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
        const { result } = renderEscrows();

        await act(async () => { await result.current.syncEscrow(params); });

        expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/escrows/sync", { method: "POST", body: params });
        expectOrdersInvalidated();
    });

    it.each(jsonMutations)("$name propagates a rejected request without invalidating orders", async ({ invoke }) => {
        const failure = new Error("Dummy request failed");
        vi.mocked(apiFetch).mockRejectedValueOnce(failure);
        const { result } = renderEscrows();

        await act(async () => { await expect(invoke(result.current)).rejects.toBe(failure); });

        expect(apiFetch).toHaveBeenCalledTimes(1);
        expectOrdersUnchanged();
    });

    it("uploadEvidence propagates a rejected upload without invalidating orders", async () => {
        const failure = new Error("Dummy upload failed");
        vi.mocked(apiFetch).mockRejectedValueOnce(failure);
        const { result } = renderEscrows();
        const file = new File(["dummy"], "dummy.txt");

        await act(async () => { await expect(result.current.uploadEvidence("dummy-escrow", file)).rejects.toBe(failure); });

        expect(apiFetch).toHaveBeenCalledTimes(1);
        expectOrdersUnchanged();
    });
});
