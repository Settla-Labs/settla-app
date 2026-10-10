"use client";

import { useCallback, useRef, useState } from "react";
import { useUser } from "@/features/user/presentation/context/UserContext";
import { useWallet } from "@/features/wallet";

export type SendStep =
  | "form"
  | "loading"
  | "confirm"
  | "signing"
  | "submitting"
  | "success"
  | "error"
  | "cancelled";

export interface RecipientInfo {
  address: string;
  alias: string | null;
  exists: boolean;
  hasUsdcTrustline: boolean;
}

export interface SendState {
  step: SendStep;
  recipient: RecipientInfo | null;
  fee: string | null;
  txHash: string | null;
  errorMessage: string | null;
}

interface PreparedTransactionResponse {
  xdr: string;
  fee: string | null;
}

// `/send/prepare` has one supported transaction field. The legacy names are
// inspected only so an ambiguous payload is rejected rather than guessed at.
const PREPARED_XDR_FIELD = "xdr" as const;
const LEGACY_PREPARED_XDR_FIELDS = [
  "unsignedXdr",
  "txXdr",
  "transaction",
  "envelope",
] as const;

function decodePreparedTransaction(payload: unknown): PreparedTransactionResponse {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error('Server response did not include a valid "xdr" transaction.');
  }

  const record = payload as Record<string, unknown>;
  const candidateFields = [PREPARED_XDR_FIELD, ...LEGACY_PREPARED_XDR_FIELDS]
    .filter(field => Object.prototype.hasOwnProperty.call(record, field));

  if (candidateFields.length > 1) {
    throw new Error("Server response included multiple transaction fields and was rejected.");
  }

  const xdr = record[PREPARED_XDR_FIELD];
  if (candidateFields[0] !== PREPARED_XDR_FIELD || typeof xdr !== "string" || !xdr.trim()) {
    throw new Error('Server response did not include a valid "xdr" transaction.');
  }

  return {
    xdr,
    fee: typeof record.fee === "string" ? record.fee : null,
  };
}

export function useSend() {
  const { accessToken } = useUser();
  const { signTransaction } = useWallet();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET";
  const preparedXdrRef = useRef<string | null>(null);

  const [state, setState] = useState<SendState>({
    step: "form",
    recipient: null,
    fee: null,
    txHash: null,
    errorMessage: null,
  });

  const resolveAndPrepare = useCallback(
    async (query: string, amount: string, assetCode?: string) => {
      setState(s => ({ ...s, step: "loading", errorMessage: null }));
      preparedXdrRef.current = null;

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        const resolveRes = await fetch(
          `${apiUrl}/send/resolve?recipient=${encodeURIComponent(query)}`,
          { headers }
        );
        if (!resolveRes.ok) {
          const body = await resolveRes.json().catch(() => ({}));
          throw new Error((body as { message?: string })?.message ?? "Could not resolve recipient");
        }
        const recipient: RecipientInfo = await resolveRes.json();

        const prepareBody: { recipient: string; amount: string; asset?: string } = {
          recipient: recipient.address,
          amount,
        };
        if (assetCode && assetCode !== "native") {
          prepareBody.asset = assetCode;
        }

        const prepareRes = await fetch(`${apiUrl}/send/prepare`, {
          method: "POST",
          headers,
          body: JSON.stringify(prepareBody),
        });
        if (!prepareRes.ok) {
          const body = await prepareRes.json().catch(() => ({}));
          throw new Error((body as { message?: string })?.message ?? "Failed to prepare transaction");
        }
        const prepared = decodePreparedTransaction(await prepareRes.json());

        preparedXdrRef.current = prepared.xdr;
        setState(s => ({ ...s, step: "confirm", recipient, fee: prepared.fee ?? null }));
      } catch (err) {
        setState(s => ({
          ...s,
          step: "error",
          errorMessage: err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      }
    },
    [accessToken, apiUrl]
  );

  const confirmSend = useCallback(async () => {
    const xdr = preparedXdrRef.current;
    if (!xdr) {
      setState(s => ({ ...s, step: "error", errorMessage: "Transaction data missing — please go back and try again." }));
      return;
    }

    setState(s => ({ ...s, step: "signing", errorMessage: null }));

    let signedXdr: string;
    try {
      signedXdr = await signTransaction(xdr, network);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message :
        typeof err === "string" ? err :
        "Signing failed";
      const isCancelled = /cancel|decline|reject|denied|user rejected/i.test(msg);
      setState(s => ({
        ...s,
        step: isCancelled ? "cancelled" : "error",
        errorMessage: isCancelled ? null : msg,
      }));
      return;
    }

    setState(s => ({ ...s, step: "submitting" }));
    try {
      const submitHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) submitHeaders["Authorization"] = `Bearer ${accessToken}`;
      const submitRes = await fetch(`${apiUrl}/send/submit`, {
        method: "POST",
        headers: submitHeaders,
        body: JSON.stringify({ signedXdr }),
      });
      if (!submitRes.ok) {
        const body = await submitRes.json().catch(() => ({}));
        throw new Error((body as { message?: string })?.message ?? "Transaction submission failed");
      }
      const result: { hash?: string } = await submitRes.json();
      setState(s => ({ ...s, step: "success", txHash: result.hash ?? null }));
    } catch (err) {
      setState(s => ({
        ...s,
        step: "error",
        errorMessage: err instanceof Error ? err.message : "Transaction submission failed",
      }));
    }
  }, [accessToken, apiUrl, signTransaction, network]);

  const reset = useCallback(() => {
    preparedXdrRef.current = null;
    setState({ step: "form", recipient: null, fee: null, txHash: null, errorMessage: null });
  }, []);

  const backToConfirm = useCallback(() => {
    setState(s => ({ ...s, step: "confirm", errorMessage: null }));
  }, []);

  return { state, resolveAndPrepare, confirmSend, reset, backToConfirm };
}
