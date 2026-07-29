'use client';
import { apiFetch } from '@/lib/apiFetch';

import { useQuery } from '@tanstack/react-query';

export interface Proposal {
    id: string;
    clientName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    currentStage: string;
    [key: string]: any;
}

export interface FetchProposalsOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tab?: string;
    profileId?: string;
    fields?: string;
    enabled?: boolean;
}

export function useProposals(options: FetchProposalsOptions = {}) {
    const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        tab = '',
        profileId = '',
        fields = 'id,client_name,total_amount,status,created_at,current_stage,assigned_to,next_follow_up_date,is_converted,profile_id,query_id,client_id,temp_client_id,professional_fee,government_fee,processing_days,processing_hours',
        enabled = true
    } = options;

    return useQuery({
        queryKey: ['proposals', { page, limit, search, status, tab, profileId, fields }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                status,
                tab,
                profileId,
                fields
            });
            const res = await apiFetch(`/api/proposals?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch proposals');
            const result = await res.json();
            return {
                data: Array.isArray(result.data) ? result.data : [],
                pagination: result.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 }
            };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

export function useProposal(id: string | null) {
    return useQuery({
        queryKey: ['proposal', id],
        queryFn: async () => {
            if (!id) return { data: null };
            try {
                const res = await apiFetch(`/api/proposals/${id}`);
                if (!res.ok) throw new Error('Failed to fetch proposal');
                const result = await res.json();
                return {
                    data: result.data
                };
            } catch (err) {
                console.error("useProposal error:", err);
                return { data: null };
            }
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
