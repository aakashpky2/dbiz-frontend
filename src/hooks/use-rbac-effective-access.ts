'use client';

import { useQuery } from '@tanstack/react-query';
import { rbacService } from '@/services/rbacService';

export function useRbacEffectiveAccess(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: ['rbacEffectiveAccess', userId],
        queryFn: async () => {
            if (!userId) return null;
            const response = await rbacService.getUserEffectiveAccess(userId);
            return response?.data || null;
        },
        enabled: Boolean(userId && enabled),
        staleTime: 5 * 60 * 1000,
    });
}
