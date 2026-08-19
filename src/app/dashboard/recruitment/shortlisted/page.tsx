"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, FileText, CheckCircle2, XCircle } from "lucide-react";
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from "@/lib/supabase";
import { PageHero } from '@/components/dashboard/page-hero';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import dynamic from 'next/dynamic';
const ScheduleInterviewModal = dynamic(() => import("@/components/dashboard/recruitment/schedule-interview-modal").then(mod => mod.ScheduleInterviewModal), { ssr: false });

interface Candidate {
    id: string;
    name: string;
    position: string;
    email?: string;
    phone?: string;
    resumeUrl?: string;
    resumeName?: string;
    source?: string;
    status: string;
    date: string;
    appliedDate?: string;
    assignedHR?: string;
}

export default function ShortlistedPage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // RBAC
    const { hasRole, isSuperAdmin, hasPermission } = usePermissions();
    const canManageCandidates = hasPermission('MANAGE_RECRUITMENT');
    const canEditStatus = canManageCandidates;

    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [schedulingCandidate, setSchedulingCandidate] = useState<Candidate | null>(null);

    const fetchShortlisted = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('applicants').select('*').eq('status', 'Shortlisted').order('created_at', { ascending: false });
        if (error) {
            console.error(error);
        } else if (data) {
            const mapped: Candidate[] = data.map((d: any) => ({
                id: d.id,
                name: d.name,
                email: d.email,
                phone: d.phone,
                position: d.position,
                resumeUrl: d.resume_url,
                resumeName: d.resume_name,
                source: d.source,
                appliedDate: d.applied_date,
                status: d.status,
                date: d.date
            }));
            setCandidates(mapped);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchShortlisted();
    }, []);

    const handleAction = async (id: string, name: string, newStatus: string) => {
        if (newStatus === 'Interview Scheduled') {
            const candidate = candidates.find(c => c.id === id);
            if (candidate) {
                setSchedulingCandidate(candidate);
                setIsScheduleModalOpen(true);
            }
            return;
        }

        const { error } = await supabase.from('applicants').update({ status: newStatus }).eq('id', id);
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            fetchShortlisted();
            if (newStatus === 'Rejected') {
                toast({ title: "Candidate Rejected", description: `${name} has been rejected.`, variant: "destructive" });
            }
        }
    };

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-4"
                icon={CheckCircle2}
                badge="RECRUITMENT"
                title="Shortlisted Candidates"
                description="Review candidates who have passed the initial screening."
            />

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Applicant Name</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Resume</TableHead>
                                <TableHead>Assigned HR</TableHead>
                                <TableHead>Shortlisted Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : candidates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No shortlisted candidates found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                candidates.map((candidate) => (
                                    <TableRow key={candidate.id}>
                                        <TableCell className="font-semibold">{candidate.name}</TableCell>
                                        <TableCell>{candidate.position}</TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" className="h-8">
                                                <FileText className="w-4 h-4 mr-2" /> View
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            {candidate.assignedHR ? (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700">{candidate.assignedHR}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4 mr-2" /> {candidate.date}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button disabled={!canEditStatus} size="sm" onClick={() => handleAction(candidate.id, candidate.name, 'Interview Scheduled')} className="font-bold">
                                                Schedule Interview
                                            </Button>
                                            <Button disabled={!canEditStatus} size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleAction(candidate.id, candidate.name, 'Rejected')}>
                                                Reject
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <ScheduleInterviewModal
                isOpen={isScheduleModalOpen}
                onOpenChange={setIsScheduleModalOpen}
                applicant={schedulingCandidate ? {
                    id: schedulingCandidate.id,
                    name: schedulingCandidate.name,
                    position: schedulingCandidate.position
                } : null}
                onSuccess={fetchShortlisted}
            />
        </div>
    );
}