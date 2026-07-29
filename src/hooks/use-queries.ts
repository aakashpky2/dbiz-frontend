'use client';
import { apiFetch } from '@/lib/apiFetch';

import { useQuery } from '@tanstack/react-query';

export interface QueryEntry {
    id: string;
    clientId?: string;
    profileId?: string;
    contactId?: string;
    companyName: string;
    contactPerson: string;
    contactNumber: string;
    emailId: string;
    status: 'Open' | 'Working' | 'Resolved' | 'Closed';
    createdAt: number;
    createdByName: string;
    [key: string]: any;
}

export interface FetchQueriesOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    fields?: string;
    enabled?: boolean;
}

export function useQueries(options: FetchQueriesOptions = {}) {
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        status = '',
        fields = '*',
        enabled = true 
    } = options;

    return useQuery({
        queryKey: ['queries', { page, limit, search, status, fields }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                status,
                fields
            });
            const res = await apiFetch(`/api/queries?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch queries');
            const result = await res.json();
            
            return {
                data: Array.isArray(result.data) ? result.data : [],
                stats: result.stats || { open: 0, working: 0, closed: 0 },
                pagination: result.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 }
            };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
