'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { fetchCountryCodes, normalizeDialCode } from '@/lib/country-code-utils';

interface CountryCodeSelectProps {
    value?: string;
    onChange: (code: string) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * Global CountryCodeSelect Component
 * Uses the centralized country-code-utils for fetching and normalization.
 */
export const CountryCodeSelect = ({ value, onChange, disabled, className }: CountryCodeSelectProps) => {
    const [codes, setCodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const loadCodes = async () => {
            setLoading(true);
            try {
                const data = await fetchCountryCodes();
                if (!mounted) return;
                setCodes(data);

                if (!value) {
                    const defaultCode = data.find(c => c.isDefault)?.code || '+91';
                    onChange(defaultCode);
                }
            } catch (error) {
                console.error("Error loading country codes:", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadCodes();
        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Normalize incoming value
    const normalizedValue = normalizeDialCode(value);

    return (
        <Select 
            value={normalizedValue} 
            onValueChange={(val) => onChange(normalizeDialCode(val))} 
            disabled={disabled || loading}
        >
            <SelectTrigger className={`w-[110px] h-11 font-bold text-xs bg-white border-slate-400 rounded-l-xl rounded-r-none border-r-0 focus:ring-0 transition-all ${className}`}>
                {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                ) : (
                    <div className="flex items-center justify-between w-full pr-1">
                        <SelectValue placeholder="+91" />
                    </div>
                )}
            </SelectTrigger>
            <SelectContent className="z-[200] max-h-[300px]">
                {codes.map(c => (
                    <SelectItem key={`${c.id}-${c.code}`} value={c.code} className="text-xs font-bold">
                        {c.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
