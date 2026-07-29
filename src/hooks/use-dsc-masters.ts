'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
    DSCUsageType,
    DSCPurposeType,
    DSCValidity,
    DSCFieldMaster,
    DSCFormTemplate,
    DSCPricing,
    InventoryItem,
} from '@/types/dsc';

export function useDSCMasters() {
    const { data, refetch } = useQuery({
        queryKey: ['dscMasters'],
        queryFn: async () => {
            const [
                { data: usageData },
                { data: purposeData },
                { data: validityData },
                { data: fieldData },
                { data: templateData },
                { data: pricingData },
                { data: inventoryData }
            ] = await Promise.all([
                supabase.from('dsc_types').select('*').order('sort_order'),
                supabase.from('dsc_authorities').select('*').order('sort_order'),
                supabase.from('dsc_validities').select('*').order('sort_order'),
                supabase.from('dsc_form_fields').select('*'),
                supabase.from('pdf_templates').select('*').order('name'),
                supabase.from('dsc_rates').select('*'),
                supabase.from('token_masters').select('*')
            ]);

            return {
                usageTypes: (usageData || []).map(d => ({ id: d.id, name: d.name, sortOrder: d.sort_order, isActive: d.is_active })) as any as DSCUsageType[],
                purposeTypes: (purposeData || []).map(d => ({ id: d.id, name: d.name, sortOrder: d.sort_order, isActive: d.is_active })) as any as DSCPurposeType[],
                validities: (validityData || []).map(d => ({ id: d.id, label: d.name || d.label, years: d.years, sortOrder: d.sort_order, isActive: d.is_active })) as any as DSCValidity[],
                fields: (fieldData || []).map(d => ({ id: d.id, fieldKey: d.field_key, label: d.label, fieldType: d.field_type, requiredDefault: d.required_default, isActive: d.is_active })) as any as DSCFieldMaster[],
                templates: (templateData || []).map(d => ({ id: d.id, ...d })) as any as DSCFormTemplate[],
                pricings: (pricingData || []).map(d => ({ id: d.id, usageTypeId: d.type_id, purposeTypeId: d.authority_id, validityId: d.validity_id, tokenIncluded: d.token_included, basePrice: d.base_price, gstRate: d.gst_rate, isActive: d.is_active })) as any as DSCPricing[],
                items: (inventoryData || []).map(d => ({ id: d.id, ...d })) as any as InventoryItem[],
            };
        },
        staleTime: 24 * 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const usageTypes = useMemo(() => data?.usageTypes || [], [data?.usageTypes]);
    const purposeTypes = useMemo(() => data?.purposeTypes || [], [data?.purposeTypes]);
    const validities = useMemo(() => data?.validities || [], [data?.validities]);
    const fields = useMemo(() => data?.fields || [], [data?.fields]);
    const templates = useMemo(() => data?.templates || [], [data?.templates]);
    const pricings = useMemo(() => data?.pricings || [], [data?.pricings]);
    const items = useMemo(() => data?.items || [], [data?.items]);

    const usageById = useMemo(() => Object.fromEntries(usageTypes.map(x => [x.id, x])), [usageTypes]);
    const purposeById = useMemo(() => Object.fromEntries(purposeTypes.map(x => [x.id, x])), [purposeTypes]);
    const validityById = useMemo(() => Object.fromEntries(validities.map(x => [x.id, x])), [validities]);

    return {
        usageTypes,
        purposeTypes,
        validities,
        fields,
        templates,
        pricings,
        items,
        usageById,
        purposeById,
        validityById,
        refetch,
    };
}
