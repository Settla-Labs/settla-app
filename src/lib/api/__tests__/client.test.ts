import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    apiFetch,
    getApiBaseUrl,
    setTokenProvider,
    setUnauthorizedHandler,
    setRefreshTokenHandler,
    resetCsrfToken,
} from "../client";
import { ApiError } from "../errors";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as Response;
}

function errorResponse(status: number, body: unknown): Response {
    return {
        ok: false,
        status,
        json: async () => body,
    } as Response;
}

function csrfResponse(): Response {
    return jsonResponse({ csrfToken: "test-csrf-token" });
}

// Returns the last fetch call (the actual request, skipping the CSRF prefetch).
function lastRequest(): [string, RequestInit] {
    const calls = mockFetch.mock.calls;
    return calls[calls.length - 1] as [string, RequestInit];
}

describe("apiFetch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetCsrfToken();
        setTokenProvider(() => "test-token");
        setUnauthorizedHandler(null);
        setRefreshTokenHandler(null);
        process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000";
    });

    afterEach(() => {
        setTokenProvider(null);
        setUnauthorizedHandler(null);
        setRefreshTokenHandler(null);
        resetCsrfToken();
    });

    describe("getApiBaseUrl", () => {
        it("returns NEXT_PUBLIC_API_URL", () => {
            expect(getApiBaseUrl()).toBe("http://localhost:3000");
        });

        it("throws when NEXT_PUBLIC_API_URL is not set", () => {
            delete process.env.NEXT_PUBLIC_API_URL;
            expect(() => getApiBaseUrl()).toThrow("Backend API URL is not configured.");
        });
    });

    describe("basic requests", () => {
        it("makes a GET request and returns JSON", async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }));

            const result = await apiFetch<{ id: number }>("/test");

            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3000/test",
                expect.objectContaining({
                    credentials: "include",
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-token",
                    }),
                }),
            );
            expect(result).toEqual({ id: 1 });
        });

        it("makes a POST request with JSON body", async () => {
            mockFetch
                .mockResolvedValueOnce(csrfResponse())
                .mockResolvedValueOnce(jsonResponse({ created: true }));

            await apiFetch("/test", {
                method: "POST",
                body: { name: "foo" },
            });

            expect(mockFetch.mock.calls[0][0]).toContain("/auth/csrf");
            const [url, options] = lastRequest();
            expect(url).toBe("http://localhost:3000/test");
            expect(options).toEqual(expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ name: "foo" }),
                credentials: "include",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "x-csrf-token": "test-csrf-token",
                }),
            }));
        });

        it("returns undefined for 204 responses", async () => {
            mockFetch
                .mockResolvedValueOnce(csrfResponse())
                .mockResolvedValueOnce({
                    ok: true,
                    status: 204,
                    json: async () => {
                        throw new Error("no body");
                    },
                } as unknown as Response);

            const result = await apiFetch("/test", { method: "DELETE" });
            expect(result).toBeUndefined();
            expect(lastRequest()[1].credentials).toBe("include");
        });

        it.each([200, 202])("returns undefined for an empty %i response body", async (status) => {
            const response = {
                ok: true,
                status,
                text: vi.fn().mockResolvedValue(""),
                json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
            } as unknown as Response;
            mockFetch.mockResolvedValueOnce(response);

            await expect(apiFetch<void>("/test")).resolves.toBeUndefined();
            expect(response.text).toHaveBeenCalledOnce();
            expect(response.json).not.toHaveBeenCalled();
        });

        it("still parses non-empty JSON in a successful response", async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ id: 42 }));

            await expect(apiFetch<{ id: number }>("/test")).resolves.toEqual({ id: 42 });
        });

        it("rejects invalid, non-empty JSON rather than masking malformed responses", async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "not-json" } as Response);

            await expect(apiFetch("/test")).rejects.toThrow(SyntaxError);
        });
    });
    describe("authentication", () => {
        it("injects Authorization header when authenticated (default)", async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test");

            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:3000/test",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer test-token",
                    }),
                }),
            );
        });

        it("does not inject Authorization header when authenticated: false", async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test", { authenticated: false });

            const [, options] = lastRequest();
            expect((options.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
            expect(options.credentials).toBe("include");
        });

        it("does not inject Authorization header when no token is available", async () => {
            setTokenProvider(() => null);
            mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test");

            const [, options] = lastRequest();
            expect((options.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
        });
    });

    describe("error handling", () => {
        it("throws ApiError on non-ok response", async () => {
            mockFetch.mockResolvedValueOnce(
                errorResponse(400, { statusCode: 400, error: "BAD_REQUEST", message: "Invalid input" }),
            );

            try {
                await apiFetch("/test");
            } catch (err) {
                expect(err).toBeInstanceOf(ApiError);
                expect((err as ApiError).status).toBe(400);
                expect((err as ApiError).code).toBe("BAD_REQUEST");
                expect((err as ApiError).message).toBe("Invalid input");
                return;
            }
            throw new Error("Expected apiFetch to throw");
        });

        it("uses defaultError when backend has no message", async () => {
            mockFetch.mockResolvedValueOnce(
                errorResponse(500, { statusCode: 500, error: "INTERNAL" }),
            );

            try {
                await apiFetch("/test", { defaultError: "Custom default" });
            } catch (err) {
                expect((err as ApiError).message).toBe("Custom default");
            }
        });

        it("joins array messages from backend", async () => {
            mockFetch.mockResolvedValueOnce(
                errorResponse(400, { message: ["Error one", "Error two"] }),
            );

            try {
                await apiFetch("/test");
            } catch (err) {
                expect((err as ApiError).message).toBe("Error one, Error two");
            }
        });
    });

    describe("401 handling", () => {
        it("calls refresh token handler and retries on 401 when authenticated", async () => {
            const refreshHandler = vi.fn().mockResolvedValue("new-token");
            setRefreshTokenHandler(refreshHandler);

            mockFetch
                .mockResolvedValueOnce(errorResponse(401, { message: "Unauthorized" }))
                .mockResolvedValueOnce(jsonResponse({ ok: true }));

            const result = await apiFetch("/test");

            expect(refreshHandler).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ ok: true });

            const secondCallHeaders = mockFetch.mock.calls[1][1].headers;
            expect(secondCallHeaders.Authorization).toBe("Bearer new-token");
        });

        it("calls unauthorizedHandler and throws when no refresh handler and 401", async () => {
            const logout = vi.fn();
            setUnauthorizedHandler(logout);

            mockFetch.mockResolvedValueOnce(errorResponse(401, {}));

            await expect(apiFetch("/test")).rejects.toThrow(ApiError);
            expect(logout).toHaveBeenCalledTimes(1);
        });

        it("does not trigger 401 handling when authenticated: false", async () => {
            const logout = vi.fn();
            setUnauthorizedHandler(logout);

            mockFetch.mockResolvedValueOnce(errorResponse(401, {}));

            await expect(apiFetch("/test", { authenticated: false })).rejects.toThrow(ApiError);
            expect(logout).not.toHaveBeenCalled();
        });

        it("throws when refresh handler returns null", async () => {
            setRefreshTokenHandler(async () => null);
            const logout = vi.fn();
            setUnauthorizedHandler(logout);

            mockFetch.mockResolvedValueOnce(errorResponse(401, {}));

            await expect(apiFetch("/test")).rejects.toThrow("Sesión expirada");
            expect(logout).toHaveBeenCalledTimes(1);
        });
    });

    describe("FormData handling", () => {
        it("does not set Content-Type for FormData bodies", async () => {
            mockFetch
                .mockResolvedValueOnce(csrfResponse())
                .mockResolvedValueOnce(jsonResponse({ uploaded: true }));
            const formData = new FormData();
            formData.append("file", new Blob(["test"]), "test.txt");

            await apiFetch("/upload", { method: "POST", body: formData });

            const [, options] = lastRequest();
            expect(options.body).toBe(formData);
            const headers = options.headers as Record<string, string>;
            expect(headers["Content-Type"]).toBeUndefined();
            expect(headers["x-csrf-token"]).toBe("test-csrf-token");
        });

        it("preserves user-supplied Content-Type", async () => {
            mockFetch
                .mockResolvedValueOnce(csrfResponse())
                .mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test", {
                method: "POST",
                body: { data: "test" },
                headers: { "Content-Type": "text/plain" },
            });

            const [, options] = lastRequest();
            const headers = options.headers as Record<string, string>;
            expect(headers["Content-Type"]).toBe("text/plain");
            expect(headers["x-csrf-token"]).toBe("test-csrf-token");
        });
    });

    describe("CSRF protection", () => {
        it("does not prefetch a CSRF token for GET requests", async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test", { method: "GET" });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [, options] = lastRequest();
            expect((options.headers as Record<string, string>)["x-csrf-token"]).toBeUndefined();
        });

        it("caches the CSRF token across mutating requests", async () => {
            mockFetch
                .mockResolvedValueOnce(csrfResponse())
                .mockResolvedValueOnce(jsonResponse({ ok: true }))
                .mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test", { method: "POST", body: { a: 1 } });
            await apiFetch("/test", { method: "PATCH", body: { a: 2 } });

            expect(mockFetch.mock.calls[0][0]).toContain("/auth/csrf");
            expect(mockFetch).toHaveBeenCalledTimes(3);
            const [, firstRequest] = mockFetch.mock.calls[1];
            const [, secondRequest] = mockFetch.mock.calls[2];
            expect((firstRequest.headers as Record<string, string>)["x-csrf-token"]).toBe("test-csrf-token");
            expect((secondRequest.headers as Record<string, string>)["x-csrf-token"]).toBe("test-csrf-token");
        });

        it("still sends the request when the CSRF token cannot be fetched", async () => {
            mockFetch
                .mockResolvedValueOnce(errorResponse(500, { message: "csrf unavailable" }))
                .mockResolvedValueOnce(jsonResponse({ ok: true }));

            await apiFetch("/test", { method: "PUT", body: { a: 1 } });

            const [, options] = lastRequest();
            expect((options.headers as Record<string, string>)["x-csrf-token"]).toBeUndefined();
            expect(options.credentials).toBe("include");
        });
    });
});
