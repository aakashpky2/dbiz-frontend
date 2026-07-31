'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAttendance } from '@/contexts/AttendanceContext';
import { Building, Briefcase, Calendar as CalendarIcon, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

export function DashboardHero() {
    const { user, loading: authLoading } = useAuth();
    const { employeeDetails, isLoading: attendanceLoading } = useAttendance();
    const isFetching = authLoading || attendanceLoading;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (isFetching) {
        return (
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-12 shadow-2xl h-48 animate-pulse">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
            </div>
        );
    }

    const initials = (user?.displayName || 'U').substring(0, 2).toUpperCase();
    const roleDisplay = employeeDetails?.systemRole?.name ?? (attendanceLoading ? 'Loading...' : 'Unassigned Role');
    const deptDisplay = employeeDetails?.department?.name || 'Not Assigned';
    const profileDisplay = employeeDetails?.profile?.profile_name || 'Not Assigned';

    return (
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-10 shadow-2xl animate-in fade-in zoom-in duration-700">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <Avatar className="h-20 w-20 ring-4 ring-slate-800 shadow-xl">
                        <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                        <AvatarFallback className="bg-slate-800 text-white text-2xl font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-2">
                            Welcome back, {user?.displayName?.split(' ')[0]} <span className="text-2xl">👋</span>
                        </h1>
                        <p className="text-indigo-400 font-semibold text-lg tracking-wide">{roleDisplay}</p>
                        <p className="text-slate-400 text-sm max-w-md pt-2 leading-relaxed">
                            {getGreeting()},<br />Here's what's happening in your business today.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                        <Badge variant="secondary" className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/50 backdrop-blur px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                            <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                            <span className="font-medium text-xs">Role:</span> {roleDisplay}
                        </Badge>
                        {profileDisplay !== 'Not Assigned' && (
                            <Badge variant="secondary" className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/50 backdrop-blur px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                                <Building className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="font-medium text-xs">Profile:</span> {profileDisplay}
                            </Badge>
                        )}
                        {deptDisplay !== 'Not Assigned' && (
                            <Badge variant="secondary" className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/50 backdrop-blur px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                                <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                                <span className="font-medium text-xs">Dept:</span> {deptDisplay}
                            </Badge>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-2 bg-slate-900/50 w-fit px-3 py-1.5 rounded-full border border-slate-800">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {format(new Date(), 'EEEE, MMMM do yyyy')}
                    </div>
                </div>
            </div>
        </div>
    );
}
