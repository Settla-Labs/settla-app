import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stage1 from '../Stage1';
import { useUsers } from '../../../../../features/user/hooks/useUsers';

vi.mock('../../../../../features/user/hooks/useUsers', () => ({
    useUsers: vi.fn(),
}));

const mockedUseUsers = vi.mocked(useUsers);
const checkAliasAvailable = vi.fn();

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe('Stage1 alias availability', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        checkAliasAvailable.mockReset();
        mockedUseUsers.mockReturnValue({
            checkAliasAvailable,
        } as unknown as ReturnType<typeof useUsers>);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    async function enterAlias(alias: string) {
        fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
            target: { value: alias },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
    }

    it.each([
        [true, /available/i],
        [false, /already taken/i],
    ])('renders the backend availability result %s', async (available, expectedText) => {
        checkAliasAvailable.mockResolvedValue({ available });
        render(<Stage1 onNext={vi.fn()} />);

        await enterAlias('satoshi');

        expect(screen.getByRole('status').textContent).toMatch(expectedText);
    });

    it('shows a retryable error instead of reporting a failed request as taken', async () => {
        checkAliasAvailable.mockRejectedValue(new Error('backend unavailable'));
        render(<Stage1 onNext={vi.fn()} />);

        await enterAlias('satoshi');

        expect(screen.getByRole('alert').textContent).toMatch(/could not check availability/i);
        expect(screen.queryByText(/already taken/i)).toBeNull();
    });

    it('ignores an older response that resolves after the newest alias check', async () => {
        const oldCheck = deferred<{ available: boolean }>();
        const newCheck = deferred<{ available: boolean }>();
        checkAliasAvailable
            .mockReturnValueOnce(oldCheck.promise)
            .mockReturnValueOnce(newCheck.promise);
        render(<Stage1 onNext={vi.fn()} />);

        await enterAlias('old-alias');
        await enterAlias('new-alias');

        await act(async () => newCheck.resolve({ available: true }));
        expect(screen.getByText(/✓ available/i)).toBeTruthy();

        await act(async () => oldCheck.resolve({ available: false }));
        expect(screen.getByText(/✓ available/i)).toBeTruthy();
        expect(screen.queryByText(/already taken/i)).toBeNull();
    });
});
