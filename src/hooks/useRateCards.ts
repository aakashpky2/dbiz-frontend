import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rateCardService } from '@/services/rateCardService';
import { useToast } from '@/hooks/use-toast';

export function useRateCards(filters: Record<string, unknown> = {}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const serializedFilters = JSON.stringify(filters);
    const stableFilters = useMemo(() => {
        try {
            return JSON.parse(serializedFilters);
        } catch {
            return {};
        }
    }, [serializedFilters]);

    // Stable query key from filters — prevents infinite re-renders even when caller passes a new object reference
    const queryKey = useMemo(() => ['rateCards', stableFilters], [stableFilters]);

    const { data, isLoading: loading, error: queryError, refetch } = useQuery({
        queryKey,
        queryFn: async () => {
            const res = await rateCardService.getAll(stableFilters);

            // Normalize response shape
            const list = Array.isArray(res)
                ? res
                : Array.isArray(res?.data)
                    ? res.data
                    : Array.isArray(res?.rateCards)
                        ? res.rateCards
                        : [];

            const pagination = !Array.isArray(res) ? {
                total: res?.total || list.length,
                page: res?.page || 1,
                limit: res?.limit || 10,
                totalPages: res?.total_pages || res?.totalPages || 1,
            } : { total: list.length, page: 1, limit: list.length, totalPages: 1 };

            return { rateCards: list, pagination };
        },
        staleTime: 60 * 1000, // 1 minute — rate cards don't change on every render
        placeholderData: (prev) => prev, // Keep showing previous results while fetching new page
    });

    const error = queryError ? (queryError as Error).message || 'Failed to load rate cards' : null;
    const rateCards = data?.rateCards ?? [];
    const pagination = data?.pagination ?? { total: 0, page: 1, limit: 10, totalPages: 0 };

    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    const deleteRateCard = useCallback(async (id: string) => {
        try {
            const response = await rateCardService.delete(id);
            if (response.success) {
                toast({ title: 'Success', description: 'Rate card deleted successfully' });
                queryClient.invalidateQueries({ queryKey: ['rateCards'] });
                return true;
            } else {
                toast({ title: 'Error', description: response.error || 'Failed to delete rate card', variant: 'destructive' });
                return false;
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete rate card';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
            return false;
        }
    }, [toast, queryClient]);

    return { rateCards, loading, error, pagination, refresh, deleteRateCard };
}
