'use client';

import { PageHero } from '@/components/dashboard/page-hero';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Building, Mail, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PageSkeleton } from '@/components/ui/page-skeleton';

interface TemporaryClient {
    id: string;
    company_name: string;
    contact_person: string;
    contact_number: string;
    email_id: string;
    status: string;
    created_at: string;
    is_converted: boolean;
}

export default function TemporaryClientsPage() {
    const { toast } = useToast();
    const [clients, setClients] = useState<TemporaryClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchTempClients = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/temporary-clients');
            if (res.ok) {
                const response = await res.json();
                console.log("[TempClients] response", response);
                const list = Array.isArray(response) ? response : (response?.data || []);
                setClients(list);
            }
        } catch (error) {
            console.error("Error fetching temp clients:", error);
            toast({ title: "Error", description: "Failed to load temporary clients", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTempClients();
    }, []);

    const handleConvert = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to approve and convert "${name}" to a permanent client?`)) return;

        setProcessingId(id);
        try {
            const res = await fetch(`/api/temporary-clients/convert/${id}`, {
                method: 'POST'
            });

            if (res.ok) {
                toast({ title: "Success", description: `"${name}" has been converted to a permanent client.` });
                setClients(clients.filter(c => c.id !== id));
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Conversion failed');
            }
        } catch (error: any) {
            toast({ title: "Conversion Failed", description: error.message, variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6 p-6 animate-in fade-in duration-500">
            <PageHero
                pattern="pattern-3"
                icon={User}
                badge="ADMINISTRATION"
                title="Temporary Clients"
                description="Review and approve new clients added during the inquiry process."
            />

            <Card className="shadow-lg border-muted/50 rounded-xl overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        Pending Approvals
                        <Badge variant="secondary" className="h-5">{clients.length}</Badge>
                    </CardTitle>
                    <CardDescription>Clients awaiting verification before being added to master database</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (<div className="p-6"><PageSkeleton /></div>) : clients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <CheckCircle2 className="h-16 w-16 text-emerald-500/20 mb-4" />
                            <h3 className="text-xl font-bold">All caught up!</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-[320px]">
                                There are no temporary clients waiting for approval at the moment.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40 uppercase text-[10px] font-black tracking-widest">
                                    <TableHead className="pl-6">Company Details</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Received On</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map((client) => (
                                    <TableRow key={client.id} className="hover:bg-muted/5 transition-colors group">
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                    <Building className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground text-sm uppercase">{client.company_name}</span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <User className="h-3 w-3" /> {client.contact_person}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5">
                                                {client.contact_number && (
                                                    <span className="text-xs font-medium flex items-center gap-2">
                                                        <Phone className="h-3 w-3 text-muted-foreground" /> {client.contact_number}
                                                    </span>
                                                )}
                                                {client.email_id && (
                                                    <span className="text-xs font-medium flex items-center gap-2">
                                                        <Mail className="h-3 w-3 text-muted-foreground" /> {client.email_id}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-bold text-foreground">
                                                {format(new Date(client.created_at), 'dd MMM yyyy')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button 
                                                onClick={() => handleConvert(client.id, client.company_name)}
                                                disabled={processingId === client.id}
                                                size="sm"
                                                className="rounded-xl font-bold gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all px-4"
                                            >
                                                {processingId === client.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                )}
                                                Approve & Convert
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
