import { apiFetch } from '@/lib/apiFetch';
import { useQuery } from '@tanstack/react-query';

export interface WorkRecord {
    id: string;
    clientId: string;
    clientName: string;
    departmentId: string;
    departmentName: string;
    categoryId: string;
    categoryName: string;
    workTypeId: string;
    workTypeName: string;
    workTypeStatus: string;
    occurrence: string;
    financialYear: string;
    period: string | null;
    priority: string;
    referenceType: string;
    associateId: string | null;
    associateName: string | null;
    associateEffectiveDate: string | null;
    dueDate: string | null;
    finishByDate: string | null;
    finishByTime: string | null;
    status: string;
    enteredBy: string | null;
    enteredByName: string;
    enteredDate: string | null;
    enteredTime: string | null;
    remarks: string | null;
    proposalId: string | null;
    createdAt: string;
}

interface WorksResponse {
    data: WorkRecord[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export function useWorks({ page = 1, limit = 10, search = '', fields = '*' } = {}) {
    return useQuery<WorksResponse>({
        queryKey: ['works', page, limit, search, fields],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search,
                fields
            });
            const response = await apiFetch(`/api/works?${params}`);
            if (!response.ok) throw new Error('Failed to fetch works');
            const result = await response.json();
            return {
                data: Array.isArray(result.data) ? result.data : [],
                pagination: result.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 }
            };
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
}
