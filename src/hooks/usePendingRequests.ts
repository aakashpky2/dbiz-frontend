import { useState, useEffect, useCallback, useMemo } from 'react';
import { rateCardService } from '@/services/rateCardService';

export function usePendingRequests(filters: Record<string, unknown> = {}) {
    const [requests, setRequests] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const serializedFilters = JSON.stringify(filters);
    const stableFilters = useMemo(() => {
        try {
            return JSON.parse(serializedFilters);
        } catch {
            return {};
        }
    }, [serializedFilters]);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await rateCardService.getPendingRequests(stableFilters);
            setRequests(res?.data || []);
        } catch (err: unknown) {
            console.error('[usePendingRequests] Failed to fetch:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load pending requests';
            setError(errorMessage);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [stableFilters]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    return {
        requests,
        loading,
        error,
        refetch: fetchRequests
    };
}
