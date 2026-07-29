'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { governmentFeeService } from '../services/governmentFeeService';
import { useToast } from '@/hooks/use-toast';

export function useGovernmentFees() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: fees = [], isLoading: loading, error: queryError, refetch } = useQuery({
        queryKey: ['governmentFees'],
        queryFn: async () => {
            const res = await governmentFeeService.getRules();
            if (res.success) {
                return res.data || [];
            }
            throw new Error(res.error || 'Failed to fetch fees');
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const error = queryError ? queryError.message : null;

    const fetchFees = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const createFee = async (data: any) => {
        try {
            const res = await governmentFeeService.createRule(data);
            if (!res.success) throw new Error(res.error || `Failed to create fee`);
            toast({ title: 'Success', description: `Government fee created successfully.` });
            await queryClient.invalidateQueries({ queryKey: ['governmentFees'] });
            return res.data;
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            return null;
        }
    };

    const updateFee = async (id: string, data: any) => {
        try {
            const res = await governmentFeeService.updateRule(id, data);
            if (!res.success) throw new Error(res.error || `Failed to update fee`);
            toast({ title: 'Success', description: `Government fee updated successfully.` });
            await queryClient.invalidateQueries({ queryKey: ['governmentFees'] });
            return res.data;
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            return null;
        }
    };

    const deleteFee = async (id: string) => {
        try {
            const res = await governmentFeeService.deleteRule(id);
            if (!res.success) throw new Error(res.error || `Failed to delete fee`);
            toast({ title: 'Success', description: `Government fee deleted successfully.` });
            await queryClient.invalidateQueries({ queryKey: ['governmentFees'] });
            return res.data;
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            return null;
        }
    };

    return {
        loading,
        error,
        fees,
        fetchFees,
        createFee,
        updateFee,
        deleteFee
    };
}
