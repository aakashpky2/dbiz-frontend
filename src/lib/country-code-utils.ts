import { supabase } from '@/lib/supabase';

/**
 * Global Country Code Utility System
 * Source of truth for all country-code related logic across the project.
 */

/**
 * 1. normalizeDialCode(input)
 * - Accept: "91", "+91", "India", "INDIA", "UK", "United Kingdom", "US", "USA", "United States"
 * - Return: "+91", "+44", "+1"
 * - Always return a + prefixed numeric code.
 * - If invalid, return "+91".
 */
export const normalizeDialCode = (input: string | undefined | null): string => {
    if (!input) return '+91';

    const normalized = input.trim().toLowerCase();

    // Map common country names/aliases to codes
    const nameMap: Record<string, string> = {
        'india': '+91',
        'uk': '+44',
        'united kingdom': '+44',
        'us': '+1',
        'usa': '+1',
        'united states': '+1',
        'united states of america': '+1',
    };

    if (nameMap[normalized]) return nameMap[normalized];

    // If it's already a numeric code
    const digits = normalized.replace(/\D/g, '');
    if (digits) {
        return `+${digits}`;
    }

    return '+91';
};

/**
 * 2. parseCountryCodeMasterValue(row)
 * Support description formats:
 * { "code": "+91", "isDefault": true }
 * { "code": "91", "isDefault": true }
 * { "dialCode": "+91" }
 * { "phoneCode": "91" }
 */
export const parseCountryCodeMasterValue = (row: any) => {
    if (!row || !row.name) return null;

    let code = '+91';
    let isDefault = false;

    if (row.description) {
        try {
            const desc = typeof row.description === 'string' 
                ? JSON.parse(row.description) 
                : row.description;
            
            const rawCode = desc.code || desc.dialCode || desc.phoneCode;
            if (rawCode) {
                code = normalizeDialCode(String(rawCode));
            }
            isDefault = !!desc.isDefault;
        } catch (e) {
            // If description is not JSON, try treating it as a raw code
            code = normalizeDialCode(row.description);
        }
    }

    // Safety check: Never return +INDIA
    if (code.match(/[a-z]/i)) {
        code = '+91';
    }

    return {
        id: row.id,
        countryName: row.name,
        code: code,
        label: `${code} ${row.name}`,
        isDefault,
        order: row.order || 0
    };
};

/**
 * 3. getFallbackCountryCodes()
 */
export const getFallbackCountryCodes = () => [
    { countryName: "India", code: "+91", label: "+91 India", isDefault: true, id: 'fb-in', order: 0 },
    { countryName: "United Kingdom", code: "+44", label: "+44 United Kingdom", isDefault: false, id: 'fb-uk', order: 1 },
    { countryName: "United States", code: "+1", label: "+1 United States", isDefault: false, id: 'fb-us', order: 2 }
];

/**
 * 4. fetchCountryCodes()
 * - Fetch from Supabase: app_master_categories where name ilike "Country Codes"
 */
export const fetchCountryCodes = async () => {
    try {
        const { data: catData, error: catError } = await supabase
            .from('app_master_categories')
            .select('id')
            .ilike('name', 'Country Codes')
            .single();

        if (catError || !catData) {
            console.warn("Country Codes category not found, using fallbacks");
            return getFallbackCountryCodes();
        }

        const { data: valData, error: valError } = await supabase
            .from('app_master_values')
            .select('*')
            .eq('category_id', catData.id)
            .eq('is_active', true)
            .order('order', { ascending: true });

        if (valError || !valData || valData.length === 0) {
            return getFallbackCountryCodes();
        }

        const parsed = valData
            .map(parseCountryCodeMasterValue)
            .filter(Boolean) as any[];

        if (parsed.length === 0) return getFallbackCountryCodes();

        // Sort: default first, then order, then countryName
        return parsed.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            if (a.order !== b.order) return a.order - b.order;
            return a.countryName.localeCompare(b.countryName);
        });
    } catch (error) {
        console.error("Error fetching country codes:", error);
        return getFallbackCountryCodes();
    }
};
