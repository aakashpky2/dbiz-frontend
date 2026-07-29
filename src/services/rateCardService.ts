import { apiFetch } from '@/lib/apiFetch';
// Using relative paths to leverage Next.js rewrites and avoid CORS/PNA issues
const API_BASE = '/api/rate-cards';

/**
 * Standard headers for all rate-card API requests.
 * Authentication is handled via the session cookie (credentials: 'include').
 * We do NOT manually attach x-user-id — the backend resolves identity from the JWT cookie.
 */
const BASE_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
};

export const rateCardService = {
    getAll: async (filters: any = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });

        const response = await apiFetch(`${API_BASE}?${params.toString()}`, {
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch rate cards');
        }

        return data;
    },
    getPendingRequests: async (filters: any = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });

        const response = await apiFetch(`${API_BASE}/requests?${params.toString()}`, {
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch pending requests');
        }

        return data;
    },
    getById: async (id: string) => {
        const response = await apiFetch(`${API_BASE}/${id}?_t=${Date.now()}`, {
            headers: BASE_HEADERS,
            credentials: 'include',
            cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch rate card');
        return data;
    },
    create: async (data: any) => {
        const response = await apiFetch(API_BASE, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create rate card');
        return result;
    },
    update: async (id: string, data: any) => {
        const response = await apiFetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update rate card');
        return result;
    },
    delete: async (id: string) => {
        const response = await apiFetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete rate card');
        return result;
    },
    getActiveRate: async (params: { client_type: string; associate_id?: string; work_item_id: string; target_date?: string }) => {
        const query = new URLSearchParams(params as any).toString();
        const response = await apiFetch(`${API_BASE}/active?${query}`, {
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch active rate');
        return data;
    },
    addItem: async (rateCardId: string, data: any) => {
        const response = await apiFetch(`${API_BASE}/${rateCardId}/items`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to add item');
        return result;
    },
    updateItem: async (rateCardId: string, itemId: string, data: any) => {
        const response = await apiFetch(`${API_BASE}/${rateCardId}/items/${itemId}`, {
            method: 'PUT',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update item');
        return result;
    },
    deleteItem: async (rateCardId: string, itemId: string) => {
        const response = await apiFetch(`${API_BASE}/${rateCardId}/items/${itemId}`, {
            method: 'DELETE',
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete item');
        return result;
    },
    submit: async (id: string) => {
        const response = await apiFetch(`${API_BASE}/${id}/submit`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to submit rate card');
        return result;
    },
    approve: async (id: string) => {
        const response = await apiFetch(`${API_BASE}/${id}/approve`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to approve rate card');
        return result;
    },
    reject: async (id: string, rejection_reason: string) => {
        const response = await apiFetch(`${API_BASE}/${id}/reject`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify({ rejection_reason })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to reject rate card');
        return result;
    },
    approveRequest: async (requestId: string) => {
        const response = await apiFetch(`${API_BASE}/requests/${requestId}/approve`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to approve request');
        return result;
    },
    rejectRequest: async (requestId: string, rejection_reason: string) => {
        const response = await apiFetch(`${API_BASE}/requests/${requestId}/reject`, {
            method: 'POST',
            headers: BASE_HEADERS,
            credentials: 'include',
            body: JSON.stringify({ rejection_reason })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to reject request');
        return result;
    }
};
