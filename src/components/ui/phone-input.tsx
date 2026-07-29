'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { normalizeToDigits } from '@/lib/phone-utils';
import { CountryCodeSelect } from '@/components/common/CountryCodeSelect';

export interface PhoneInputProps {
    value?: string;
    onChange?: (value: string) => void;
    countryCode?: string;
    onCountryCodeChange?: (code: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const PhoneInput = ({ 
    value, 
    onChange, 
    countryCode = '+91', 
    onCountryCodeChange,
    placeholder, 
    disabled, 
    className 
}: PhoneInputProps) => {
    const [localNumber, setLocalNumber] = useState('');

    useEffect(() => {
        const safeValue = value || '';
        if (safeValue !== localNumber) {
            setLocalNumber(safeValue);
        }
    }, [value, localNumber]);

    return (
        <div className={`flex gap-0 group ${className || ''}`}>
            <CountryCodeSelect 
                value={countryCode} 
                onChange={(code) => {
                    onCountryCodeChange?.(code);
                }} 
                disabled={disabled}
                className="w-[85px] border-2 group-focus-within:border-primary/50"
            />
            <Input
                type="tel"
                value={localNumber}
                onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setLocalNumber(raw);
                    onChange?.(raw);
                }}
                onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    const normalized = normalizeToDigits(pastedText);
                    setLocalNumber(normalized);
                    onChange?.(normalized);
                }}
                placeholder={placeholder || '9876543210'}
                disabled={disabled}
                className="flex-1 h-11 font-medium tracking-wider rounded-l-none border-2 border-l-0 focus:ring-0 focus:border-primary/50 transition-all tabular-nums"
            />
        </div>
    );
};
