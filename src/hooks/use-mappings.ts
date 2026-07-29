'use client';

import { apiFetch } from '@/lib/apiFetch';
import { useQuery } from '@tanstack/react-query';

export function useMappings() {
  const { data: mappings = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['sourceMappings'],
    queryFn: async () => {
      try {
        const res = await apiFetch('/api/government-fees/source-mappings');
        const data = await res.json();
        let validMappings = [];
        if (data.success) {
          validMappings = (data.data || []).filter((m: any) => m.is_active && m.is_visible);
        } else if (Array.isArray(data)) {
          validMappings = data.filter((m: any) => m.is_active && m.is_visible);
        }
        return validMappings;
      } catch (err) {
        console.error("Error fetching mappings", err);
        return [];
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  return { mappings, loading, refresh: refetch };
}
