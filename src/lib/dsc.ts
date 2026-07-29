import type { DSCPricing } from '@/types/dsc';

export function computeTotalPrice(basePrice: number, gstRate?: number) {
    const r = typeof gstRate === 'number' ? gstRate : 0;
    const gst = (basePrice * r) / 100;
    return Math.round((basePrice + gst) * 100) / 100;
}

function isWithinEffective(p: DSCPricing, dateISO: string) {
    const from = p.effectiveFrom || '0000-01-01';
    const to = p.effectiveTo || '9999-12-31';
    return dateISO >= from && dateISO <= to;
}

export function pickActivePricing(
    all: DSCPricing[],
    usageTypeId: string,
    purposeTypeId: string,
    validityId: string,
    tokenIncluded: boolean,
    dateISO: string
) {
    return all
        .filter(p => p.isActive !== false)
        .filter(p => p.usageTypeId === usageTypeId)
        .filter(p => p.purposeTypeId === purposeTypeId)
        .filter(p => p.validityId === validityId)
        .filter(p => !!p.tokenIncluded === !!tokenIncluded)
        .filter(p => isWithinEffective(p, dateISO))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}
