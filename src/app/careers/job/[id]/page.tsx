"use client";
import { DynamicFieldsSection } from '@/components/dashboard/recruitment/dynamic-fields-section';


import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, MapPin, ArrowLeft, Building2, Calendar, FileText, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import type { JobOpening } from "@/app/dashboard/recruitment/jobs/page";
import { MasterItem } from "@/components/dashboard/recruitment/master-table";

const applicationSchema = z.object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Valid phone number is required"),
    linkedin: z.string().url("Valid URL required").optional().or(z.literal('')),
    portfolio: z.string().url("Valid URL required").optional().or(z.literal('')),
    experienceYears: z.coerce.number().min(0, "Experience cannot be negative"),
    currentLocation: z.string().min(2, "Current location is required"),
    resume: z.any().optional(), // File handling mock
    interestReason: z.string().min(10, "Please provide a more detailed reason"),
    sourceId: z.string().min(1, "Please select how you heard about us"),
    referringEmployee: z.string().optional(),
    dynamic_fields: z.record(z.any()).optional(),
});

type ApplicationValues = z.infer<typeof applicationSchema>;

export default function JobDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [job, setJob] = useState<JobOpening | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplyOpen, setIsApplyOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sources, setSources] = useState<MasterItem[]>([]);

    const form = useForm<ApplicationValues>({
        resolver: zodResolver(applicationSchema),
        defaultValues: {
            fullName: "", email: "", phone: "", linkedin: "", portfolio: "",
            experienceYears: 0, currentLocation: "", interestReason: "", sourceId: "", referringEmployee: ""
        },
    });

    const selectedSource = form.watch("sourceId");
    const isReferralSelected = sources.find(s => s.id === selectedSource)?.name.toLowerCase().includes('referral');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Job
                const { data: jobData, error: jobError } = await supabase.from('job_openings').select('*').eq('id', id).single();
                if (jobError) throw jobError;
                if (jobData) setJob(jobData);

                // Fetch sources
                const { data: sourceData, error: sourceError } = await supabase.from('recruitment_sources').select('id, name');
                if (sourceData) setSources(sourceData.map((s: any) => ({ ...s, status: s.status || 'Active' })));

            } catch (err: any) {
                console.error('Failed to fetch data', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const onSubmit = async (data: ApplicationValues) => {
        setIsSubmitting(true);
        try {
            // Check for duplicates
            const { data: existing } = await supabase.from('applicants')
                .select('id').eq('email', data.email).eq('job_id', id).maybeSingle();
                
            if (existing) {
                toast({ title: "Application Failed", description: "You have already applied for this role.", variant: "destructive" });
                return;
            }

            const dbPayload = {
                name: data.fullName, email: data.email, phone: data.phone, position: job?.title || "Unknown", job_id: id,
                resume_url: "mock_resume.pdf", resume_name: "Resume.pdf",
                source: sources.find(s => s.id === data.sourceId)?.name || "Unknown",
                referring_employee: data.referringEmployee || null,
                applied_date: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0],
                status: 'Applied',
                experience: data.experienceYears.toString(),
                location: data.currentLocation,
                dynamic_fields: data.dynamic_fields || {}
            };

            const { error: insertErr } = await supabase.from('applicants').insert([dbPayload]);
            if (insertErr) throw insertErr;

            // Increment applicant count
            const newCount = (job?.applicants_count || 0) + 1;
            await supabase.from('job_openings').update({ applicants_count: newCount }).eq('id', id);

            toast({ title: "Application Submitted", description: "Thank you for applying. Our HR team will review your application." });
            setIsApplyOpen(false);
            form.reset();

        } catch (err: any) {
            toast({ title: "Error submitting application", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!job) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <h1 className="text-3xl font-bold mb-4 text-gray-800">Job Not Found</h1>
                <p className="text-muted-foreground mb-8">This position may have been closed or removed.</p>
                <Link href="/careers"><Button><ArrowLeft className="w-4 h-4 mr-2" /> Back to Careers</Button></Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto py-4 px-6 flex items-center justify-between">
                    <Link href="/careers" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to open positions
                    </Link>
                    <Button onClick={() => setIsApplyOpen(true)} className="rounded-full shadow-md font-bold px-8">Apply Now</Button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto pt-10 px-6">
                <div className="mb-10">
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-sm py-1 px-3 border-none shadow-sm">{job.employment_type}</Badge>
                        <Badge variant="outline" className="text-gray-600 bg-white shadow-sm text-sm py-1 px-3 border-gray-200">
                            {job.department}
                        </Badge>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">{job.title}</h1>

                    <div className="flex flex-wrap items-center gap-6 text-gray-600 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center text-sm font-medium">
                            <MapPin className="w-5 h-5 mr-2 text-primary/70" /> {job.location}
                        </div>
                        <div className="flex items-center text-sm font-medium">
                            <BriefcaseBusiness className="w-5 h-5 mr-2 text-primary/70" /> {job.experience} Required
                        </div>
                        <div className="flex items-center text-sm font-medium">
                            <Calendar className="w-5 h-5 mr-2 text-primary/70" /> Apply by {new Date(job.deadline).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-2 space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 bg-gradient-to-bl from-primary to-transparent w-32 h-32 rounded-tr-2xl pointer-events-none"></div>
                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-gray-900 border-b pb-2">About the Role</h2>
                            <div className="prose prose-blue max-w-none text-gray-600 space-y-4">
                                {job.description.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-gray-900 border-b pb-2">Skills Required</h2>
                            <div className="flex flex-wrap gap-2">
                                {job.skills.split(',').map((skill, index) => (
                                    <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-700 py-1.5 px-4 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                                        {skill.trim()}
                                    </Badge>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-6">
                        <Card className="shadow-lg border-primary/20 sticky top-24 overflow-hidden">
                            <div className="h-2 bg-primary w-full absolute top-0 left-0"></div>
                            <CardHeader className="pt-6">
                                <CardTitle>Ready to join us?</CardTitle>
                                <CardDescription>We're excited to learn more about you and your experience.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={() => setIsApplyOpen(true)} className="w-full text-lg h-12 rounded-xl shadow-md group">
                                    Apply for this job <Send className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-sm text-blue-900">
                            <h4 className="font-bold flex items-center mb-2">
                                <Building2 className="w-4 h-4 mr-2" /> Our Process
                            </h4>
                            <ul className="space-y-2 opacity-90 pl-6 list-disc">
                                <li>Initial Application Review</li>
                                <li>HR Screening Call</li>
                                <li>Technical Assessment</li>
                                <li>Final Interview Panel</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>

            {/* Application Modal */}
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
                    <DialogHeader className="border-b pb-4 mb-4">
                        <DialogTitle className="text-2xl text-primary flex items-center">
                            <FileText className="w-6 h-6 mr-3 opacity-80" /> Apply for Job
                        </DialogTitle>
                        <DialogDescription>
                            Enter your application details for {job.title}.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-5">
                                <FormField control={form.control} name="fullName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="John Doe" {...field} className="h-11 bg-gray-50/50 focus:bg-white transition-colors" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input type="email" placeholder="john@example.com" {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="+1 234 567 8900" {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="currentLocation" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Current Location <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="City, Country" {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="linkedin" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>LinkedIn Profile URL</FormLabel>
                                        <FormControl><Input placeholder="https://linkedin.com/in/..." {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="portfolio" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Portfolio / GitHub URL</FormLabel>
                                        <FormControl><Input placeholder="https://github.com/..." {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="experienceYears" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Years of Experience <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input type="number" min="0" step="0.5" {...field} className="h-11 bg-gray-50/50 focus:bg-white" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="sourceId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>How did you hear about us? <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 bg-gray-50/50 focus:bg-white"><SelectValue placeholder="Select a source" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {isReferralSelected && (
                                <FormField control={form.control} name="referringEmployee" render={({ field }) => (
                                    <FormItem className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                        <FormLabel className="text-blue-900 font-semibold">Referring Employee Name <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input placeholder="Enter referrer's name" {...field} className="h-11 border-blue-200 focus:border-blue-400 focus:ring-blue-100" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            <FormField control={form.control} name="interestReason" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Why are you interested in this role? <span className="text-destructive">*</span></FormLabel>
                                    <FormControl><Textarea placeholder="Tell us what motivates you..." className="min-h-[120px] bg-gray-50/50 focus:bg-white transition-colors resize-y" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="resume" render={({ field: { value, onChange, ...fieldProps } }) => (
                                <FormItem className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                                    <FormLabel className="font-semibold text-lg flex items-center">
                                        <FileText className="w-5 h-5 mr-2 text-gray-500" /> Resume / CV <span className="text-destructive ml-1">*</span>
                                    </FormLabel>
                                    <p className="text-sm text-muted-foreground mb-4">Please upload your resume in PDF format (Max 5MB).</p>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            className="h-12 file:bg-primary file:text-primary-foreground file:h-full file:-ml-4 file:-mt-2 file:px-6 file:border-0 file:mr-4 file:font-semibold file:cursor-pointer file:shadow-sm cursor-pointer border-gray-300"
                                            onChange={(event) => {
                                                const file = event.target.files && event.target.files[0];
                                                onChange(file);
                                            }}
                                            {...fieldProps}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <DynamicFieldsSection formName="Job Application Form" control={form.control} />

                            <DialogFooter className="pt-6 border-t mt-8 gap-3 sm:gap-0">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-medium">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" className="h-12 px-10 rounded-xl font-bold text-base shadow-md group relative overflow-hidden" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                                    {!isSubmitting && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                                    <span className="relative flex items-center">Submit Application <Send className="w-4 h-4 ml-2" /></span>
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
