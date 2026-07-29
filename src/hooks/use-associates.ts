'use client';
import { apiFetch } from '@/lib/apiFetch';

import { useQuery } from '@tanstack/react-query';

export interface Associate {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    [key: string]: any;
}

export interface FetchAssociatesOptions {
    page?: number;
    limit?: number;
    search?: string;
    fields?: string;
    enabled?: boolean;
}

export function useAssociates(options: FetchAssociatesOptions = {}) {
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        fields = 'id,name,email,phone,status,company_name,parent_id',
        enabled = true 
    } = options;

    return useQuery({
        queryKey: ['associates', { page, limit, search, fields }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                fields
            });
            const res = await apiFetch(`/api/associates?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch associates');
            const result = await res.json();
            return {
                data: Array.isArray(result.data) ? result.data : [],
                pagination: result.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 }
            };
        },
        enabled,
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

export function useAssociate(id: string | null) {
    return useQuery({
        queryKey: ['associate', id],
        queryFn: async () => {
            if (!id) return { data: null };
            try {
                const res = await apiFetch(`/api/associates/${id}`);
                if (!res.ok) throw new Error('Failed to fetch associate');
                const result = await res.json();
                return {
                    data: result.data || result
                };
            } catch (err) {
                console.error("useAssociate error:", err);
                return { data: null };
            }
        },
        enabled: !!id,
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
