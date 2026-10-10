import type { Socket } from 'socket.io-client';
import { createAuthedSocket } from '@/lib/socket';
import {
    ClientToServerEvents,
    ServerToClientEvents,
} from '../types/chat-events.types';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createChatSocket(accessToken: string): ChatSocket | null {
    return createAuthedSocket(
        process.env.NEXT_PUBLIC_API_URL,
        accessToken,
    ) as ChatSocket | null;
}
