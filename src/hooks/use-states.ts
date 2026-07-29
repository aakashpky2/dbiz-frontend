import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface StateData {
    value: string;
    label: string;
}

export function useStates() {
    const { data: states = [], isLoading: loading, error } = useQuery<StateData[]>({
        queryKey: ['states'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('states')
                .select('name, code')
                .order('name');

            if (error) throw error;

            return data ? data.map(item => ({
                value: item.code || item.name,
                label: item.name
            })) : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    return { states, loading, error: error as Error | null };
}

