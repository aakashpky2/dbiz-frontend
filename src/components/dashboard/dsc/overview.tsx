'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDSCRecords } from '@/hooks/use-dsc-records';
import { fmtDate, todayISO } from './dsc-utils';

function daysBetween(aISO: string, bISO: string) {
    const a = new Date(aISO + 'T00:00:00Z').getTime();
    const b = new Date(bISO + 'T00:00:00Z').getTime();
    return Math.round((b - a) / 86400000);
}

export function DSCOverview() {
    const { issued, clientOwned } = useDSCRecords();
    const today = todayISO();

    const expiringSoon = useMemo(() => {
        const all = [...issued, ...clientOwned]
            .filter((r: any) => !!r.expiryDate)
            .map((r: any) => ({ ...r, daysLeft: daysBetween(today, r.expiryDate) }))
            .filter((r: any) => r.daysLeft >= 0 && r.daysLeft <= 30)
            .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
        return all.slice(0, 8);
    }, [issued, clientOwned, today]);

    const issuedActive = useMemo(() => issued.filter((r: any) => r.expiryDate && daysBetween(today, r.expiryDate) >= 0).length, [issued, today]);
    const clientActive = useMemo(() => clientOwned.filter((r: any) => r.expiryDate && daysBetween(today, r.expiryDate) >= 0).length, [clientOwned, today]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
                <CardHeader><CardTitle>Issued DSC</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{issued.length}</div>
                    <div className="text-sm text-muted-foreground">Active (by expiry): {issuedActive}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Client DSC</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{clientOwned.length}</div>
                    <div className="text-sm text-muted-foreground">Active (by expiry): {clientActive}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Expiring in 30 days</CardTitle></CardHeader>
                <CardContent>
                    {expiringSoon.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No DSCs expiring soon</div>
                    ) : (
                        <div className="space-y-2">
                            {expiringSoon.map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between">
                                    <div className="text-sm">
                                        <div className="font-medium">{r.personName || r.clientNameSnapshot || 'DSC'}</div>
                                        <div className="text-xs text-muted-foreground">Expiry: {fmtDate(r.expiryDate)}</div>
                                    </div>
                                    <Badge variant={r.daysLeft <= 7 ? 'destructive' : 'outline'}>{r.daysLeft}d</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
