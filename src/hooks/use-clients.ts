'use client';
import { apiFetch } from '@/lib/apiFetch';

import { useQuery } from '@tanstack/react-query';

export type ClientSimple = {
    id: string;
    clientName: string;
    companyName?: string;
    [key: string]: any;
};

export interface FetchClientsOptions {
    page?: number;
    limit?: number;
    search?: string;
    fields?: string;
    enabled?: boolean;
    constitutionId?: string;
    changeStatus?: string;
    completionStatus?: string;
}

export function useClients(options: FetchClientsOptions = {}) {
    const { 
        page = 1, 
        limit = 50, 
        search = '', 
        fields = 'id,client_name,constitution_id,reference,associate_id,change_status,completion_status,fields,contacts',
        enabled = true,
        constitutionId = '',
        changeStatus = '',
        completionStatus = ''
    } = options;

    return useQuery({
        queryKey: ['clients', { page, limit, search, fields, constitutionId, changeStatus, completionStatus }],
        queryFn: async () => {
            const paramsObj: Record<string, string> = {
                page: page.toString(),
                limit: limit.toString(),
                search,
                fields
            };
            if (constitutionId && constitutionId !== 'all') {
                paramsObj.constitution_id = constitutionId;
            }
            if (changeStatus) {
                paramsObj.change_status = changeStatus;
            }
            if (completionStatus) {
                paramsObj.completion_status = completionStatus;
            }

            const params = new URLSearchParams(paramsObj);
            const res = await apiFetch(`/api/clients?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch clients');
            const result = await res.json();
            
            const rawData = Array.isArray(result.data) ? result.data : [];
            
            return {
                data: rawData.map((val: any) => ({
                    id: val.id,
                    clientName: val.client_name || val.clientName || 'Unnamed Client',
                    companyName: val.company_name || val.companyName,
                    constitutionId: val.constitution_id || val.constitutionId,
                    ...val
                })),
                pagination: result.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 }
            };
        },
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}

export function useClient(id: string | null) {
    return useQuery({
        queryKey: ['client', id],
        queryFn: async () => {
            if (!id) return { data: null };
            try {
                const res = await apiFetch(`/api/clients/${id}`);
                if (!res.ok) throw new Error('Failed to fetch client');
                const result = await res.json();
                return {
                    data: result.data || result
                };
            } catch (err) {
                console.error("useClient error:", err);
                return { data: null };
            }
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

export function useClientStats() {
    return useQuery({
        queryKey: ['clientStats'],
        queryFn: async () => {
            const res = await apiFetch('/api/clients/stats');
            if (!res.ok) throw new Error('Failed to fetch client stats');
            return await res.json();
        },
        staleTime: 30 * 1000,
    });
}
