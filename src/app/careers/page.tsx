"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, MapPin, Search, ArrowRight, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { JobOpening } from "@/app/dashboard/recruitment/jobs/page";

export default function PublicCareersPage() {
    const [jobs, setJobs] = useState<JobOpening[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchJobs = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase.from('job_openings').select('*').eq('status', 'Open').order('created_at', { ascending: false });
                if (error) {
                    if (error.code === '42P01') throw error;
                }
                setJobs(data || []);
            } catch (err: any) {
                console.error("Error fetching jobs:", err);
                setJobs([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchJobs();
    }, []);

    const filteredJobs = jobs.filter(
        (job) => job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            job.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Careers Header */}
            <header className="bg-primary text-primary-foreground py-16 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400/20 via-primary to-primary"></div>
                <div className="max-w-5xl mx-auto relative z-10 text-center">
                    <Building2 className="w-12 h-12 mx-auto mb-6 opacity-80" />
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                        Join Our Team
                    </h1>
                    <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
                        We are always looking for passionate people to join our mission. Explore our open roles and find the perfect fit for your skills.
                    </p>

                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            className="pl-10 h-12 text-black bg-white/95 border-none shadow-lg focus-visible:ring-2 focus-visible:ring-primary/50 text-base"
                            placeholder="Search by job title or department..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Available Jobs */}
            <main className="max-w-5xl mx-auto py-12 px-6">
                <h2 className="text-2xl font-bold tracking-tight mb-6">Open Positions ({filteredJobs.length})</h2>

                {isLoading ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <BriefcaseBusiness className="w-8 h-8 mx-auto mb-4 animate-pulse opacity-50" />
                        <p>Loading available positions...</p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border shadow-sm">
                        <BriefcaseBusiness className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">No matching roles found</h3>
                        <p className="text-muted-foreground">Try adjusting your search query or check back later.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:gap-6">
                        {filteredJobs.map((job) => (
                            <Card key={job.id} className="group hover:shadow-md transition-shadow duration-200">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                                                {job.title}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                                <div className="flex items-center">
                                                    <Building2 className="w-4 h-4 mr-1.5" />
                                                    {job.department}
                                                </div>
                                                <div className="flex items-center">
                                                    <MapPin className="w-4 h-4 mr-1.5" />
                                                    {job.location}
                                                </div>
                                                <div className="flex items-center">
                                                    <BriefcaseBusiness className="w-4 h-4 mr-1.5" />
                                                    {job.experience}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">{job.employment_type}</Badge>
                                                <Badge variant="outline" className="text-gray-600">{job.salary_range || "Competitive"}</Badge>
                                            </div>
                                        </div>
                                        <div className="shrink-0 mt-2 md:mt-0">
                                            <Link href={`/careers/job/${job.id}`}>
                                                <Button className="w-full md:w-auto">
                                                    View Details <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
