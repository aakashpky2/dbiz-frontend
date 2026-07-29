'use client';
import dynamic from 'next/dynamic';
const PermissionDetailDialog = dynamic(() => import('./_components/PermissionDetailDialog').then(mod => mod.PermissionDetailDialog), { ssr: false });

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    Settings2, 
    Workflow, 
    ShieldCheck, 
    Bell, 
    History,
    AlertCircle,
    Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PermissionCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    status: boolean;
    onToggle: (val: boolean) => void;
    onClick: () => void;
    loading?: boolean;
}

const PermissionCard = ({ title, description, icon: Icon, status, onToggle, onClick, loading }: PermissionCardProps) => (
    <Card 
        className="group relative overflow-hidden border-slate-200/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
        onClick={onClick}
    >
        <div className={cn(
            "absolute top-0 left-0 w-1 h-full transition-all duration-300",
            status ? "bg-emerald-500" : "bg-slate-200"
        )} />
        
        <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
                <div className={cn(
                    "p-2 rounded-xl transition-colors duration-300",
                    status ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                )}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : (
                        <Switch 
                            checked={status} 
                            onCheckedChange={onToggle}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    )}
                </div>
            </div>
            <CardTitle className="text-lg mt-4 group-hover:text-primary transition-colors">{title}</CardTitle>
            <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                {description}
            </CardDescription>
        </CardHeader>
        
        <CardContent className="mt-auto pt-0 pb-4">
            <div className="flex items-center gap-2">
                <Badge 
                    variant={status ? "default" : "secondary"}
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                        status ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-100 text-slate-500"
                    )}
                >
                    {status ? "Active" : "Disabled"}
                </Badge>
                {status && (
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> System Managed
                    </span>
                )}
            </div>
        </CardContent>
    </Card>
);

export function PermissionsTab() {
    const [autoAssignment, setAutoAssignment] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedPermission, setSelectedPermission] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'work_auto_assignment_enabled')
                .single();

            if (error) {
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    // Not found or table doesn't exist - use default
                    setAutoAssignment(false);
                } else {
                    throw error;
                }
            } else if (data) {
                setAutoAssignment(data.value === true || data.value === 'true');
            }
        } catch (err: any) {
            console.error('Error fetching permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleToggleAutoAssignment = async (val: boolean) => {
        setToggling(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'work_auto_assignment_enabled',
                    value: val,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;

            setAutoAssignment(val);
            toast({
                title: val ? "Auto-Assignment Enabled" : "Auto-Assignment Disabled",
                description: val 
                    ? "New works will now be automatically assigned to eligible teams."
                    : "New works will require manual team assignment.",
                variant: val ? "default" : "destructive"
            });
        } catch (err: any) {
            console.error('Error updating permission:', err);
            
            // Extract detailed error info
            const details = err.details || '';
            const hint = err.hint || '';
            const message = err.message || 'Unknown Error';
            
            const fullError = `${message}${details ? ' - ' + details : ''}${hint ? ' (Hint: ' + hint + ')' : ''}`;
            
            toast({
                title: "Update Failed",
                description: `Database Error: ${fullError}. Please ensure the 'app_settings' table exists and policies are applied.`,
                variant: "destructive"
            });
        } finally {
            setToggling(false);
        }
    };

    const permissionsList = [
        {
            id: 'work_auto_assignment',
            title: "Work Auto Assignment",
            description: "Automatically assign newly created works to eligible teams based on category and availability.",
            icon: Workflow,
            status: autoAssignment,
            onToggle: handleToggleAutoAssignment,
            loading: toggling
        },
        {
            id: 'system_notifications',
            title: "Global Notifications",
            description: "Enable or disable system-wide broadcast notifications for administrative actions.",
            icon: Bell,
            status: true,
            onToggle: () => {},
            loading: false
        },
        {
            id: 'audit_logging',
            title: "Audit Trail",
            description: "Maintain a detailed history of all data mutations across administrative modules.",
            icon: History,
            status: true,
            onToggle: () => {},
            loading: false
        },
        {
            id: 'security_lockdown',
            title: "Security Hardening",
            description: "Enforce strict IP-based access and multi-factor authentication for admin accounts.",
            icon: ShieldCheck,
            status: false,
            onToggle: () => {},
            loading: false
        }
    ];

    const handleCardClick = (id: string) => {
        setSelectedPermission(id);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">System Permissions</h2>
                    <p className="text-sm text-slate-500">Configure global application behaviors and automated workflows.</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="text-xs text-amber-800 font-medium">Changes here affect all system users globally.</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i} className="h-48 animate-pulse bg-slate-50 border-slate-100" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {permissionsList.map((perm) => (
                        <PermissionCard 
                            key={perm.id}
                            title={perm.title}
                            description={perm.description}
                            icon={perm.icon}
                            status={perm.status}
                            onToggle={perm.onToggle}
                            onClick={() => handleCardClick(perm.id)}
                            loading={perm.loading}
                        />
                    ))}
                </div>
            )}

            <PermissionDetailDialog open={isDetailOpen} onOpenChange={setIsDetailOpen} selectedPermission={selectedPermission} permissionList={permissionsList} autoAssignment={autoAssignment} toggling={toggling} onToggleAutoAssignment={handleToggleAutoAssignment} />
        </div>
    );
}
