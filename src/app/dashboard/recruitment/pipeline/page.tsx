"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MapPin, BriefcaseBusiness, User, CalendarDays, Search, RefreshCw } from "lucide-react";
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHero } from '@/components/dashboard/page-hero';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from '@/hooks/use-permissions';
import { supabase } from "@/lib/supabase";

interface Candidate {
    id: string;
    name: string;
    position: string;
    source: string;
    status: string;
    date: string;
    assignedHR?: string;
    interviewDate?: string;
}

const STAGES = [
    { id: "Applied", label: "Applied", color: "bg-gray-100 border-gray-200" },
    { id: "Shortlisted", label: "Shortlisted", color: "bg-blue-50 border-blue-200" },
    { id: "Interview Scheduled", label: "Interview Scheduled", color: "bg-orange-50 border-orange-200" },
    { id: "Interview Completed", label: "Interview Completed", color: "bg-purple-50 border-purple-200" },
    { id: "Selected", label: "Selected", color: "bg-green-50 border-green-200" },
    { id: "Rejected", label: "Rejected", color: "bg-red-50 border-red-200" },
];

export default function RecruitmentPipelinePage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    // RBAC
    const { hasRole, isSuperAdmin, hasPermission } = usePermissions();
    const canManageCandidates = hasPermission('MANAGE_RECRUITMENT');
    const canEditStatus = canManageCandidates;

    const fetchPipeline = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('applicants').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error(error);
            setCandidates([]);
        } else if (data) {
            const mapped: Candidate[] = data.map((d: any) => ({
                id: d.id,
                name: d.name,
                position: d.position,
                source: d.source,
                status: d.status,
                date: d.date,
                assignedHR: d.assigned_hr,
                interviewDate: d.interview_date
            }));
            setCandidates(mapped);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPipeline();
    }, []);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedItemId(id);
        e.dataTransfer.effectAllowed = "move";
        // For visual ghost
        setTimeout(() => {
            if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '0.5';
            }
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) {
            e.target.style.opacity = '1';
        }
        setDraggedItemId(null);
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        if (!draggedItemId) return;

        const candidateToMove = candidates.find(c => c.id === draggedItemId);
        if (!candidateToMove || candidateToMove.status === newStatus) return;

        // Optimistic update
        const updatedCandidates = candidates.map(c =>
            c.id === draggedItemId ? { ...c, status: newStatus } : c
        );
        setCandidates(updatedCandidates);

        const { error } = await supabase.from('applicants').update({ status: newStatus }).eq('id', draggedItemId);
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            fetchPipeline(); // Revert
        } else {
            toast({ title: "Status Updated", description: `${candidateToMove.name} moved to ${newStatus}` });
        }
    };

    const filteredCandidates = candidates.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.position.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <PageHero
                pattern="pattern-3"
                icon={BriefcaseBusiness}
                badge="RECRUITMENT"
                title="Recruitment Pipeline"
                description="Drag and drop candidates to manage their hiring stage."
            >
                <Button variant="outline" onClick={fetchPipeline} disabled={isLoading} className="font-bold">
                    <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
                </Button>
            </PageHero>

            <DashboardFilterBar>
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search candidates..."
                        className="pl-9 h-10 bg-background border-muted-foreground/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </DashboardFilterBar>

            {isLoading ? (
                <PageSkeleton />
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-8 min-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-muted">
                    {STAGES.map((stage) => {
                        const stageCandidates = filteredCandidates.filter(c => c.status === stage.id);
                        return (
                            <div
                                key={stage.id}
                                className={`flex-shrink-0 w-80 rounded-xl border ${stage.color} p-4 flex flex-col`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                            >
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="font-bold text-gray-700">{stage.label}</h3>
                                    <Badge variant="secondary" className="bg-white">{stageCandidates.length}</Badge>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                                    {stageCandidates.map(candidate => (
                                        <Card
                                            key={candidate.id}
                                            draggable={canEditStatus}
                                            onDragStart={(e) => canEditStatus && handleDragStart(e, candidate.id)}
                                            onDragEnd={handleDragEnd}
                                            className={`${canEditStatus ? 'cursor-grab hover:border-primary/50 hover:shadow-md' : 'cursor-not-allowed opacity-80'} shadow-sm border-gray-200 transition-all ${draggedItemId === candidate.id ? 'opacity-50' : ''}`}
                                        >
                                            <CardContent className="p-4 space-y-3">
                                                <div className="font-bold text-sm">{candidate.name}</div>

                                                <div className="text-xs text-muted-foreground flex items-center">
                                                    <BriefcaseBusiness className="w-3 h-3 mr-1" /> {candidate.position}
                                                </div>

                                                {candidate.assignedHR && (
                                                    <div className="text-xs text-muted-foreground flex items-center">
                                                        <User className="w-3 h-3 mr-1" /> HR: {candidate.assignedHR}
                                                    </div>
                                                )}

                                                {candidate.interviewDate && (stage.id.includes('Interview')) && (
                                                    <div className="text-xs font-medium text-orange-600 bg-orange-50 p-1.5 rounded flex items-center border border-orange-100">
                                                        <CalendarDays className="w-3 h-3 mr-1" /> {candidate.interviewDate}
                                                    </div>
                                                )}

                                                <div className="pt-2 border-t flex justify-between items-center text-[10px] text-gray-500 font-medium">
                                                    <span className="bg-gray-100 py-0.5 px-2 rounded-full">{candidate.source}</span>
                                                    <span>{candidate.date}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {stageCandidates.length === 0 && (
                                        <div className="h-full flex items-center justify-center text-sm text-gray-400 font-medium border-2 border-dashed border-gray-300/50 rounded-lg p-6 text-center">
                                            Drop candidate here
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}