"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Phone, MapPin, Briefcase, Calendar, Download, RefreshCw, Send, CheckCircle2, FileText, Clock, ExternalLink } from "lucide-react";
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/lib/supabase";

export default function CandidateProfilePage() {
    const { id } = useParams();
    const [candidate, setCandidate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [note, setNote] = useState("");
    const [timeline, setTimeline] = useState<any[]>([]);
    const { toast } = useToast();
    const { hasPermission } = usePermissions();
    const canManageCandidates = hasPermission('MANAGE_RECRUITMENT');

    useEffect(() => {
        const fetchCandidate = async () => {
            setIsLoading(true);
            const { data, error } = await supabase.from('applicants').select('*').eq('id', id).single();
            if (error) {
                console.error(error);
            } else if (data) {
                const found = {
                    ...data,
                    name: data.name,
                    position: data.position,
                    email: data.email || 'applicant@example.com',
                    phone: data.phone || '+1 234 567 8900',
                    location: data.location || 'Remote',
                    experience: data.experience || '3',
                    source: data.source,
                    date: data.date || data.created_at,
                    status: data.status,
                    interviewDate: data.interview_date
                };
                setCandidate(found);

                // Mock Timeline
                setTimeline([
                    { id: 1, type: 'Application', title: 'Application Submitted', desc: `Applied for ${found.position} via ${found.source}`, date: found.date },
                    ...(found.status !== 'Applied' ? [{ id: 2, type: 'Status', title: 'Shortlisted by HR', desc: `Moved to shortlist`, date: '2026-03-02' }] : []),
                    ...(found.status.includes('Interview') || found.status === 'Selected' ? [{ id: 3, type: 'Interview', title: 'Interview Scheduled', desc: `Scheduled for ${found.interviewDate || 'a future date'}`, date: '2026-03-03' }] : []),
                    ...(found.status === 'Selected' ? [{ id: 4, type: 'Offer', title: 'Candidate Selected', desc: 'HR sent offer letter.', date: '2026-03-05' }] : []),
                ]);
            }
            setIsLoading(false);
        };
        fetchCandidate();
    }, [id]);

    if (isLoading) return <div className="p-8"><PageSkeleton /></div>;
    if (!candidate) return <div className="text-center py-20 text-muted-foreground">Candidate not found</div>;

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary text-2xl font-bold">
                        {candidate.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">{candidate.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1" /> {candidate.position}</span>
                            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {candidate.location}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><ExternalLink className="w-4 h-4 mr-2" /> Portfolio/LinkedIn</Button>
                    <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Download Resume</Button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader><CardTitle className="text-lg flex items-center"><User className="w-5 h-5 mr-2 text-primary" /> Candidate Details</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                <div>
                                    <div className="text-muted-foreground mb-1">Email <Mail className="w-3 h-3 inline ml-1 opacity-50" /></div>
                                    <div className="font-medium text-gray-900">{candidate.email}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">Phone <Phone className="w-3 h-3 inline ml-1 opacity-50" /></div>
                                    <div className="font-medium text-gray-900">{candidate.phone}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">Source <RefreshCw className="w-3 h-3 inline ml-1 opacity-50" /></div>
                                    <div className="font-medium text-gray-900">
                                        <Badge variant="secondary" className="font-normal">{candidate.source}</Badge>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">Experience Years</div>
                                    <div className="font-medium text-gray-900">{candidate.experience} Years</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader><CardTitle className="text-lg flex items-center"><FileText className="w-5 h-5 mr-2 text-primary" /> Interview Feedback</CardTitle></CardHeader>
                        <CardContent>
                            {candidate.status.includes('Completed') || candidate.status === 'Selected' ? (
                                <div className="bg-gray-50 p-4 rounded-xl border">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-bold text-gray-900">Technical Round Panel</div>
                                            <div className="text-xs text-muted-foreground">Scored by HR/Tech Lead</div>
                                        </div>
                                        <Badge className="bg-green-100 text-green-800 border-none hover:bg-green-200">Strong Hire</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="bg-white p-2 rounded border text-center">
                                            <div className="text-xs text-gray-500">Tech Skills</div>
                                            <div className="font-bold">4/5</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border text-center">
                                            <div className="text-xs text-gray-500">Communication</div>
                                            <div className="font-bold">5/5</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border text-center">
                                            <div className="text-xs text-gray-500">Problem Solving</div>
                                            <div className="font-bold">4/5</div>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-700 italic border-l-2 border-primary pl-3 bg-white p-2 rounded-r">
                                        "Candidate showed excellent architecture knowledge. Good culture fit."
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-6 border border-dashed rounded-lg">
                                    No feedback submitted yet.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Timeline & Notes */}
                <div className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader><CardTitle className="text-lg flex items-center"><Clock className="w-5 h-5 mr-2 text-primary" /> Activity Timeline</CardTitle></CardHeader>
                        <CardContent>
                            <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                                {timeline.map((event, idx) => (
                                    <div key={idx} className="relative pl-6">
                                        <div className="absolute w-4 h-4 rounded-full bg-primary/20 border-2 border-primary -left-[9px] top-1"></div>
                                        <div className="font-bold text-gray-900 text-sm">{event.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">{event.desc}</div>
                                        <div className="text-[10px] text-gray-400 mt-1">{new Date(event.date).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="pb-3"><CardTitle className="text-sm font-bold text-gray-700">Internal HR Notes</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea placeholder="Add a private note about this candidate..." value={note} onChange={e => setNote(e.target.value)} className="min-h-[100px] text-sm" />
                            {canManageCandidates && <Button className="w-full text-xs h-9" onClick={() => { setNote(""); toast({ title: "Note Saved" }); }}><Send className="w-3 h-3 mr-2" /> Save Note</Button>}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}