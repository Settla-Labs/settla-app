'use client';

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "../models/users";
import { CreateUser } from "../models/createUser";
import { SetupAccountPayload } from "../models/setupAccount";
import { useUser } from "../presentation/context/UserContext";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useUsers() {
    const { setAccessToken, setCurrentUser } = useUser();
    const queryClient = useQueryClient();

    const [userFound, setUserFound] = useState<Record<string, Users>>({});
    const [setupError, setSetupError] = useState<string | null>(null);

    const { data: users = [] } = useQuery<Users[]>({
        queryKey: queryKeys.users.all,
        queryFn: () => apiFetch<Users[]>('/users')
    });

    const getUser = useCallback(async (userId: string) => {
        try {
            const data = await queryClient.fetchQuery({
                queryKey: queryKeys.users.detail(userId),
                queryFn: () => apiFetch<Users>(`/users/${userId}`)
            });
            setUserFound(prev => ({ ...prev, [userId]: data }));
            return data;
        } catch (error) {
            console.error(error);
        }
    }, [queryClient]);

    const { mutateAsync: createUserMutation } = useMutation({
        mutationFn: (user: CreateUser) => apiFetch<Users>('/users', {
            method: "POST",
            body: user
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
        }
    });

    const createUser = async (user: CreateUser) => {
        try {
            await createUserMutation(user);
        } catch (error) {
            console.error('Error creating user:', error);
        }
    };

    const { mutateAsync: updateUserMutation } = useMutation({
        mutationFn: ({ userId, userData }: { userId: string, userData: Partial<Users> }) => apiFetch<Users>(`/users/${userId}`, {
            method: "PATCH",
            body: userData
        }),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.userId) });
            setCurrentUser(data);
        }
    });

    const updateUser = async (userId: string, userData: Partial<Users>): Promise<Users | null> => {
        try {
            return await updateUserMutation({ userId, userData });
        } catch (error) {
            console.error('Error updating user:', error);
            return null;
        }
    };

    const { mutateAsync: uploadProfilePictureMutation } = useMutation({
        mutationFn: ({ userId, file }: { userId: string, file: File }) => {
            const formData = new FormData();
            formData.append("profileImage", file);
            return apiFetch<Users>(`/users/${userId}/profile-picture`, {
                method: "PATCH",
                body: formData
            });
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.userId) });
            setCurrentUser(data);
        }
    });

    const uploadProfilePicture = async (userId: string, file: File): Promise<Users | null> => {
        try {
            return await uploadProfilePictureMutation({ userId, file });
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            return null;
        }
    };

    const getOrCreateByWallet = async (publicKey: string): Promise<Users | null> => {
        try {
            return await apiFetch<Users>(`/users/account?publicKey=${publicKey}`);
        } catch (error) {
            console.error('Error in getOrCreateByWallet:', error);
            return null;
        }
    };

    const checkAliasAvailable = useCallback(
        (alias: string): Promise<{ available: boolean }> =>
            apiFetch<{ available: boolean }>(
                `/users/validate-alias?alias=${encodeURIComponent(alias)}`,
            ),
        [],
    );

    const setupAccount = async (userId: string, payload: SetupAccountPayload): Promise<Users | null> => {
        setSetupError(null);
        try {
            const data = await apiFetch<{ user: Users; access_token: string }>(`/users/${userId}/setup`, {
                method: "POST",
                body: payload
            });
            setCurrentUser(data.user);
            setAccessToken(data.access_token);
            return data.user;
        } catch (error) {
            console.error('Error in setupAccount:', error);
            setSetupError(error instanceof Error ? error.message : 'Setup account error');
            return null;
        }
    };

    const clearSetupError = () => setSetupError(null);

    return {
        users,
        user: null,
        getUser,
        createUser,
        updateUser,
        uploadProfilePicture,
        userFound,
        getOrCreateByWallet,
        checkAliasAvailable,
        setupAccount,
        setupError,
        clearSetupError,
    };
}
