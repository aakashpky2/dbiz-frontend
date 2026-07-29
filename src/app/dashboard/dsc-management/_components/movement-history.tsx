'use client';

import React, { useState, useEffect } from 'react';
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { DSCMovement, DSC, Client } from './types';
import { format } from 'date-fns';
import { PageSkeleton } from '@/components/ui/page-skeleton';

interface MovementHistoryProps {
    dscs: DSC[];
    clients: Client[];
}

export function MovementHistory({ dscs, clients }: MovementHistoryProps) {
    const [movements, setMovements] = useState<DSCMovement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchMovements = async () => {
            const { data, error } = await supabase.from('dsc_movements').select('*').order('created_at', { ascending: false });
            if (data && !error) {
                const list = data.map((m: any) => ({
                    id: m.id, dscId: m.dsc_id, movementType: m.movement_type,
                    movementDate: m.movement_date, clientId: m.client_id,
                    roleKey: m.role_key, memberId: m.member_id, remarks: m.remarks,
                    createdAt: new Date(m.created_at).getTime()
                }));
                setMovements(list);
            } else {
                setMovements([]);
            }
            setIsLoading(false);
        };
        fetchMovements();
    }, []);

    const getDSCName = (id: string) => {
        const d = dscs.find(x => x.id === id);
        return d ? d.companyName : id;
    };

    const getClientName = (id?: string) => {
        if (!id) return '-';
        const c = clients.find(x => x.id === id);
        return c ? c.clientName : id;
    };

    const getMemberName = (clientId?: string, roleKey?: string, memberId?: string) => {
        if (!clientId || !roleKey || !memberId) return '-';
        const client = clients.find(c => c.id === clientId);
        if (client && client.roles && client.roles[roleKey]?.members && client.roles[roleKey].members![memberId]) {
            const mDetails = client.roles[roleKey].members![memberId].details;
            return mDetails?.name || mDetails?.fullName || mDetails?.email || memberId;
        }
        return memberId;
    };

    if (isLoading) return <div className="p-6"><PageSkeleton /></div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Movement History</CardTitle>
                <CardDescription>Recent check-in and check-out activity.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>DSC</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Holder</TableHead>
                            <TableHead>Remarks</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.map((m) => (
                            <TableRow key={m.id}>
                                <TableCell>{format(new Date(m.movementDate), 'dd-MMM-yyyy')}</TableCell>
                                <TableCell className="font-medium">{getDSCName(m.dscId)}</TableCell>
                                <TableCell>
                                    <span className={m.movementType === 'IN' ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                                        {m.movementType === 'IN' ? 'Check In' : 'Check Out'}
                                    </span>
                                </TableCell>
                                <TableCell>{getClientName(m.clientId)}</TableCell>
                                <TableCell>
                                    {m.movementType === 'OUT' ? (
                                        <div className="flex flex-col text-xs">
                                            <span className="font-semibold">{getMemberName(m.clientId, m.roleKey, m.memberId)}</span>
                                            <span className="text-muted-foreground">{m.roleKey}</span>
                                        </div>
                                    ) : '-'}
                                </TableCell>
                                <TableCell>{m.remarks}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
