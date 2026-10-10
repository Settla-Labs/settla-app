import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChatSocket } from "../useChatSocket";
import { createChatSocket } from "../../services/chat-socket.service";
import type { Message } from "../../models/message";

vi.mock("../../services/chat-socket.service", () => ({
    createChatSocket: vi.fn(),
}));

const mockedCreateChatSocket = vi.mocked(createChatSocket);

type Handler = (...args: unknown[]) => void;

interface MockSocket {
    connected: boolean;
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    io: {
        on: ReturnType<typeof vi.fn>;
        removeAllListeners: ReturnType<typeof vi.fn>;
    };
}

interface EmitCall {
    event: string;
    payload: unknown;
    ack?: (response: unknown) => void;
}

function createMockSocket() {
    const handlers: Record<string, Handler> = {};
    const ioHandlers: Record<string, Handler> = {};
    const emitCalls: EmitCall[] = [];

    const socket: MockSocket = {
        connected: false,
        on: vi.fn((event: string, handler: Handler) => {
            handlers[event] = handler;
            return socket;
        }),
        emit: vi.fn((event: string, payload: unknown, ack?: (response: unknown) => void) => {
            emitCalls.push({ event, payload, ack });
            return socket;
        }),
        connect: vi.fn(() => {
            socket.connected = true;
            return socket;
        }),
        disconnect: vi.fn(() => {
            socket.connected = false;
            return socket;
        }),
        removeAllListeners: vi.fn(),
        io: {
            on: vi.fn((event: string, handler: Handler) => {
                ioHandlers[event] = handler;
                return socket.io;
            }),
            removeAllListeners: vi.fn(),
        },
    };

    return { socket, handlers, ioHandlers, emitCalls };
}

const message: Message = {
    messageId: "msg-1",
    orderId: "order-1",
    senderId: "user-1",
    content: "hello",
    timestamp: "2026-01-01T00:00:00.000Z",
};

const baseOptions = {
    orderId: "order-1",
    accessToken: "jwt-token",
    enabled: true,
    onMessage: vi.fn(),
    onError: vi.fn(),
};

describe("useChatSocket", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedCreateChatSocket.mockReset();
    });

    it("does not open a socket when disabled or missing a token", () => {
        const { result, rerender } = renderHook(
            (props) => useChatSocket(props),
            { initialProps: { ...baseOptions, enabled: false } },
        );

        expect(result.current.status).toBe("disconnected");
        expect(mockedCreateChatSocket).not.toHaveBeenCalled();

        rerender({ ...baseOptions, accessToken: null });
        expect(mockedCreateChatSocket).not.toHaveBeenCalled();
        expect(result.current.status).toBe("disconnected");
    });

    it("stays disconnected when the shared socket factory has no URL", () => {
        mockedCreateChatSocket.mockReturnValue(null);

        const { result } = renderHook((props) => useChatSocket(props), {
            initialProps: baseOptions,
        });

        expect(result.current.status).toBe("disconnected");
        expect(mockedCreateChatSocket).toHaveBeenCalledWith("jwt-token");
    });

    it("creates a socket, connects, and reaches connected after joining the order", async () => {
        const { socket, handlers, emitCalls } = createMockSocket();
        mockedCreateChatSocket.mockReturnValue(socket as unknown as ReturnType<typeof createChatSocket>);

        const { result } = renderHook((props) => useChatSocket(props), {
            initialProps: baseOptions,
        });

        await waitFor(() => expect(result.current.status).toBe("connecting"));
        expect(mockedCreateChatSocket).toHaveBeenCalledWith("jwt-token");
        expect(socket.connect).toHaveBeenCalled();

        act(() => {
            handlers["connect"]?.();
        });
        act(() => {
            const join = emitCalls.find((c) => c.event === "join-order");
            join?.ack?.({ ok: true });
        });

        expect(result.current.status).toBe("connected");
    });

    it("forwards message-created events to onMessage", async () => {
        const { socket, handlers } = createMockSocket();
        mockedCreateChatSocket.mockReturnValue(socket as unknown as ReturnType<typeof createChatSocket>);
        const onMessage = vi.fn();

        const { result } = renderHook((props) => useChatSocket(props), {
            initialProps: { ...baseOptions, onMessage },
        });
        await waitFor(() => expect(result.current.status).toBe("connecting"));

        act(() => {
            handlers["message-created"]?.(message);
        });

        expect(onMessage).toHaveBeenCalledWith(message);
    });

    it("maps chat-error status and forwards the error to onError", async () => {
        const { socket, handlers } = createMockSocket();
        mockedCreateChatSocket.mockReturnValue(socket as unknown as ReturnType<typeof createChatSocket>);
        const onError = vi.fn();

        const { result } = renderHook((props) => useChatSocket(props), {
            initialProps: { ...baseOptions, onError },
        });
        await waitFor(() => expect(result.current.status).toBe("connecting"));

        act(() => {
            handlers["chat-error"]?.({ code: "INVALID_JWT", message: "bad token" });
        });

        expect(result.current.status).toBe("authentication-failed");
        expect(onError).toHaveBeenCalledWith({ code: "INVALID_JWT", message: "bad token" });
    });

    it("notifies a connection error once when connect_error has no structured data", async () => {
        const { socket, handlers } = createMockSocket();
        mockedCreateChatSocket.mockReturnValue(socket as unknown as ReturnType<typeof createChatSocket>);
        const onError = vi.fn();

        const { result } = renderHook((props) => useChatSocket(props), {
            initialProps: { ...baseOptions, onError },
        });
        await waitFor(() => expect(result.current.status).toBe("connecting"));

        act(() => {
            handlers["connect_error"]?.({ message: "boom" });
        });
        act(() => {
            handlers["connect_error"]?.({ message: "boom" });
        });

        expect(result.current.status).toBe("disconnected");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith({
            code: "CONNECTION_ERROR",
            message: "boom",
            orderId: "order-1",
        });
    });

    it("cleans up the socket on unmount", async () => {
        const { socket, emitCalls } = createMockSocket();
        mockedCreateChatSocket.mockReturnValue(socket as unknown as ReturnType<typeof createChatSocket>);

        const { result, unmount } = renderHook((props) => useChatSocket(props), {
            initialProps: baseOptions,
        });
        await waitFor(() => expect(result.current.status).toBe("connecting"));

        // connect() flips `connected` to true, so cleanup must emit leave-order.
        expect(socket.connected).toBe(true);

        unmount();

        expect(emitCalls.some((c) => c.event === "leave-order")).toBe(true);
        expect(socket.removeAllListeners).toHaveBeenCalled();
        expect(socket.io.removeAllListeners).toHaveBeenCalled();
        expect(socket.disconnect).toHaveBeenCalled();
    });
});
