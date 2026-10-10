export const queryKeys = {
    orders: {
        all: ['orders'] as const,
        detail: (id: string) => ['orders', id] as const,
        user: (userId: string) => ['orders', 'user', userId] as const,
    },
    offers: {
        all: ['offers'] as const,
        list: (filters?: Record<string, string>) => ['offers', { filters }] as const,
        detail: (id: string) => ['offers', id] as const,
    },
    paymentMethods: {
        all: ['paymentMethods'] as const,
        detail: (id: string) => ['paymentMethods', id] as const,
        providers: ['paymentMethods', 'providers'] as const,
    },
    users: {
        all: ['users'] as const,
        detail: (id: string) => ['users', id] as const,
    },
    stats: {
        all: ['stats'] as const,
        window: (timeWindow?: string) => ['stats', timeWindow] as const,
    },
    wallet: {
        balance: (publicKey: string | null) => ['wallet', 'balance', publicKey] as const,
        transactions: (publicKey: string | null) => ['wallet', 'transactions', publicKey] as const,
    }
}
