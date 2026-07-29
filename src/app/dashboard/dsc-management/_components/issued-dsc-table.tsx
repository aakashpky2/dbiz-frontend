'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, PlusCircle, User, FileText, CheckCircle2, Circle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DSC, DSCWorkflowStage } from "./types";

interface IssuedDSCTableProps {
    data: DSC[];
    stages: DSCWorkflowStage[];
    onEdit: (dsc: DSC) => void;
    onNewOrder: () => void;
}

const PAGE_SIZE = 10;

export function IssuedDSCTable({ data, stages, onEdit, onNewOrder }: IssuedDSCTableProps) {
    const [masters, setMasters] = useState<{ cls: any[], typ: any[], val: any[] }>({ cls: [], typ: [], val: [] });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const res = await fetch('/api/dsc/masters');
                if (res.ok) setMasters(await res.json());
            } catch (e) { console.error(e); }
        };
        fetchMasters();
    }, []);

    // Reset to page 1 when search changes or data changes
    useEffect(() => { setPage(1); }, [search, data.length]);

    const getStageName = (id?: string) => {
        if (!id) return "Pending";
        return stages.find(s => s.id === id)?.name || "Unknown";
    };

    const filtered = data.filter(d =>
        d.companyName.toLowerCase().includes(search.toLowerCase()) ||
        (d.currentHolder?.memberName || '').toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-bold text-slate-800">Issued DSC Orders</CardTitle>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-8 w-44 text-sm rounded-full"
                        />
                    </div>
                    <Button size="sm" className="rounded-full shadow-md h-8 transition-transform hover:-translate-y-0.5" onClick={onNewOrder}>
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> New Order
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Client &amp; Member</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Verification</TableHead>
                                <TableHead>KYC</TableHead>
                                <TableHead>Workflow</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="p-0 border-b-0 h-48"><EmptyState title="No data available yet" description="No results match your search or exist in the system database." /></TableCell></TableRow>
                            ) : paginated.map((dsc) => (
                                <TableRow key={dsc.id} className="hover:bg-slate-50/70 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{dsc.companyName}</span>
                                            {dsc.currentHolder?.memberName && (
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                    <User className="inline-block w-3 h-3 mr-1" /> {dsc.currentHolder.memberName}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">{dsc.typeId ? masters.typ.find((t: any) => t.id === dsc.typeId)?.name || 'Unknown Type' : dsc.type || 'Individual'}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">Class: {dsc.classId ? masters.cls.find((c: any) => c.id === dsc.classId)?.name || 'Unknown' : 'Class 3'}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">Validity: {dsc.validityId ? masters.val.find((v: any) => v.id === dsc.validityId)?.name || 'Unknown' : `${dsc.validityYears || 2} Years`}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            {(['mobile', 'email', 'video'] as const).map(v => (
                                                <div key={v} title={`${v.charAt(0).toUpperCase() + v.slice(1)} Verification`}>
                                                    {dsc.verificationStatus?.[v] === 'COMPLETED'
                                                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        : <Circle className="h-4 w-4 text-slate-300" />}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            {(['pan', 'aadhar', 'photo'] as const).map(k => (
                                                <div key={k} title={`${k.toUpperCase()} KYC`}>
                                                    {dsc.kycStatus?.[k] === 'COMPLETED'
                                                        ? <FileText className="h-4 w-4 text-sky-500" />
                                                        : <FileText className="h-4 w-4 text-slate-300" />}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-1.5 whitespace-nowrap">
                                            {getStageName(dsc.currentStageId)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={dsc.currentStatus === 'IN' ? 'secondary' : 'outline'} className={cn("text-[10px] py-0 px-1.5", dsc.currentStatus === 'IN' ? "bg-purple-50 text-purple-700 border-purple-200" : "")}>
                                            {dsc.currentStatus === 'IN' ? 'Office' : 'Client'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] py-0 px-1.5",
                                            dsc.paymentStatus === 'PAID' ? "bg-green-50 text-green-700 border-green-200" :
                                                dsc.paymentStatus === 'PARTIAL' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                    "bg-red-50 text-red-700 border-red-200"
                                        )}>
                                            {dsc.paymentStatus || 'UNPAID'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className={cn("text-xs font-medium", dsc.status === 'EXPIRED' ? "text-red-500" : "")}>{dsc.expiryDate}</span>
                                            <span className="text-[10px] text-muted-foreground">{dsc.status}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right p-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(dsc)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {filtered.length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-semibold text-slate-700">{Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-slate-700">{filtered.length}</span> records
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>

                            {/* Page number pills */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) =>
                                    p === 'ellipsis' ? (
                                        <span key={`e-${i}`} className="text-muted-foreground text-xs px-1">…</span>
                                    ) : (
                                        <Button
                                            key={p}
                                            variant={page === p ? 'default' : 'ghost'}
                                            size="icon"
                                            className={cn("h-7 w-7 rounded-full text-xs font-medium", page === p ? "shadow-md" : "text-slate-600")}
                                            onClick={() => setPage(p as number)}
                                        >
                                            {p}
                                        </Button>
                                    )
                                )}

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
