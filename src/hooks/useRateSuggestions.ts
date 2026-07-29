import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';

interface UseRateSuggestionsProps {
    workTypeId?: string;
    clientId?: string;
    associateId?: string;
    profileId?: string;
    clientType?: string;
    enabled?: boolean;
}

export function useRateSuggestions({
    workTypeId,
    clientId,
    associateId,
    profileId,
    clientType,
    enabled = true
}: UseRateSuggestionsProps) {
    
    return useQuery({
        queryKey: ['rateSuggestions', workTypeId, clientId, associateId, profileId, clientType],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('suggestions', 'true');
            if (workTypeId) params.append('work_item_id', workTypeId);
            if (clientId) params.append('client_id', clientId);
            if (associateId) params.append('associate_id', associateId);
            if (profileId) params.append('business_profile_id', profileId);
            
            // Determine client type for rate cards (direct or associate)
            let cType = clientType;
            // If it's 'existing' or 'new' (from proposal form), map it to rate card type
            if (!cType || cType === 'existing' || cType === 'new') {
                if (associateId) cType = 'associate';
                else cType = 'direct';
            }
            if (cType) params.append('client_type', cType);

            const response = await apiFetch(`/api/rate-cards/active?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch rate suggestions');
            }
            
            const data = await response.json();
            return data.success && data.data ? data.data : [];
        },
        enabled: enabled && !!workTypeId,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false
    });
}
