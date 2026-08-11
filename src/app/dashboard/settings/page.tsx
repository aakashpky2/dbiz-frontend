
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProfiles, useBusinessConstitutions, type Profile } from '@/hooks/use-profiles';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Loader2, Building, CheckCircle, Edit, Trash2, Shield, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
const ProfileForm = dynamic(() => import('@/components/dashboard/settings/profile-form').then(mod => mod.ProfileForm), { ssr: false });
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyBrandingDialog } from '@/components/dashboard/admin/company-settings/CompanyBrandingDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

const SettingsSkeleton = () => (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-10 w-40" />
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row justify-between items-start">
                                <div>
                                    <Skeleton className="h-6 w-32 mb-2" />
                                    <Skeleton className="h-4 w-48" />
                                </div>
                                <Skeleton className="h-6 w-20" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-full" />
                            </CardContent>
                            <div className="p-4 border-t flex justify-end gap-2">
                                <Skeleton className="h-9 w-36" />
                                <Skeleton className="h-9 w-20" />
                                <Skeleton className="h-9 w-24" />
                            </div>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
);

const getProfileConfigurationStatus = (profile: Profile, constitution: any) => {
    if (!constitution || !profile.profileName || !profile.constitutionId) return "Incomplete";

    // 1. Check mandatory fields
    const hasMissingFields = constitution.requiredSections?.some((section: any) =>
        section.fields?.some((f: any) => {
            if (f.requirement !== 'Mandatory') return false;
            const val = profile.fields?.[f.fieldKey];
            if (val === null || val === undefined || val === '') return true;
            if (Array.isArray(val) && val.length === 0) return true;
            if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return true;
            if (val === false) return true;
            return false;
        })
    );

    if (hasMissingFields) return "Incomplete";

    // 2. Fields are complete. Check roles.
    let rolesConfigured = true;
    if (constitution.roles && constitution.roles.length > 0) {
        rolesConfigured = constitution.roles.every((role: any) => {
            if (role.minMembers === 0) return true;
            const members = profile.roles?.[role.roleKey]?.members || [];
            return members.length >= role.minMembers;
        });

        if (rolesConfigured) {
            const hasMembers = Object.values(profile.roles || {}).some((role: any) => role.members && role.members.length > 0);
            if (hasMembers) {
                if (!profile.signatories || profile.signatories.length === 0) rolesConfigured = false;
                else if (!profile.primarySignatories || Object.values(profile.primarySignatories).filter(Boolean).length === 0) rolesConfigured = false;
            }
        }
    }

    return rolesConfigured ? "Configured" : "Partially Configured";
};

export default function SettingsPage() {
    const { profiles, loading: profilesLoading, deleteProfile, setDefaultProfile, fetchProfiles } = useProfiles();
    const { constitutions, loading: constitutionsLoading } = useBusinessConstitutions();
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
    const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [formMode, setFormMode] = useState<'edit' | 'view'>('edit');

    const { hasPermission, loading: permLoading } = usePermissions();
    const router = useRouter();
    const { toast } = useToast();
    const canManageSettings = hasPermission('MANAGE_SETTINGS') || hasPermission('MANAGE_PROFILE_SETTINGS');
    const canViewSettings = hasPermission('VIEW_SETTINGS') || hasPermission('VIEW_PROFILE_SETTINGS') || canManageSettings;



    useEffect(() => {
        if (!permLoading && !canViewSettings) {
            toast({ title: "Access Denied", description: "You do not have permission to access settings.", variant: "destructive" });
            router.push('/dashboard');
        }
    }, [permLoading, canViewSettings, router, toast]);

    const handleView = (profileId: string) => {
        setIsCreating(false);
        setEditingProfileId(profileId);
        setFormMode('view');
    };

    const handleEdit = (profileId: string) => {
        setIsCreating(false);
        setEditingProfileId(profileId);
        setFormMode('edit');
    };

    const handleCreateNew = () => {
        setEditingProfileId(null);
        setIsCreating(true);
        setFormMode('edit');
    }

    const handleCancel = () => {
        setEditingProfileId(null);
        setIsCreating(false);
        setFormMode('edit');
    };

    const handleSuccess = () => {
        fetchProfiles();
        handleCancel();
    };

    const sortedProfiles = useMemo(() => {
        return [...profiles].sort((a: Profile, b: Profile) => {
            if (a.isDefault === b.isDefault) return 0;
            return a.isDefault ? -1 : 1;
        });
    }, [profiles]);

    const handleSetDefault = async (profileId: string) => {
        const currentDefault = profiles.find(p => p.isDefault);
        if (currentDefault && currentDefault.id !== profileId) {
            setPendingDefaultId(profileId);
            return;
        }
        await executeSetDefault(profileId);
    }

    const executeSetDefault = async (profileId: string) => {
        setIsSettingDefault(profileId);
        await setDefaultProfile(profileId);
        setIsSettingDefault(null);
        setPendingDefaultId(null);
    }

    if (profilesLoading || constitutionsLoading) {
        return <SettingsSkeleton />;
    }

    const profileToEdit = editingProfileId ? profiles.find(p => p.id === editingProfileId) : null;
    const isModalOpen = isCreating || !!editingProfileId;

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            <div className="relative overflow-hidden bg-card text-card-foreground border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(59,130,246,0.05)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                
                {/* Decorative Background Illustration */}
                <div 
                    className="absolute inset-y-0 right-0 w-[60%] max-w-[900px] pointer-events-none z-0 opacity-[0.22] dark:opacity-10" 
                    style={{
                        backgroundImage: 'url(/images/business-profile-header-bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'right 60%',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 35%)',
                        maskImage: 'linear-gradient(to right, transparent 0%, black 35%)'
                    }}
                />

                <div className="relative flex items-center gap-5 z-10">
                    <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 bg-primary/10 text-primary border border-primary/20 shadow-sm rounded-xl">
                        <Building className="h-7 w-7 transition-transform duration-200 hover:scale-[1.02]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 border-transparent text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5">Management Portal</Badge>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-1 text-foreground">Business Profiles</h1>
                        <p className="text-muted-foreground text-sm max-w-lg">
                            Manage and view all Business Profiles
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10 mt-2 md:mt-0">

                    {canManageSettings && (
                        <div className="w-full md:w-auto min-w-[200px]">
                            <Button onClick={handleCreateNew} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-6 rounded-lg font-medium text-sm shadow-sm hover:shadow hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 ease-out flex items-center justify-center gap-2 group">
                                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" /> Create New Profile
                            </Button>
                        </div>
                    )}
                </div>
            </div>



            <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background [&>button]:hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{editingProfileId ? 'Update Profile' : 'Create New Profile'}</DialogTitle>
                        <DialogDescription>Comprehensive profile configuration interface.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <ProfileForm
                            existingProfile={profileToEdit || undefined}
                            onCancel={handleCancel}
                            onSuccess={handleSuccess}
                            formMode={formMode}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <div className="space-y-5">
               

                {sortedProfiles.length > 0 ? (
                    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
                        {sortedProfiles.map((profile: Profile, index: number) => {
                            const constitution = constitutions.find(c => c.id === profile.constitutionId);
                            const status = getProfileConfigurationStatus(profile, constitution);
                            let statusColor = "bg-destructive/10 text-destructive border-destructive/20";
                            if (status === "Configured") statusColor = "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
                            else if (status === "Partially Configured") statusColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                            return (
                                <Card
                                    key={profile.id}
                                    className={cn(
                                        "group relative isolate flex flex-col overflow-hidden transition-all duration-200 ease-out rounded-xl border bg-card text-card-foreground",
                                        "hover:-translate-y-[2px] hover:shadow-md",
                                        "before:absolute before:inset-0 before:origin-right before:scale-x-[0.012] before:bg-gradient-to-l before:from-cyan-400/[0.1] before:via-sky-400/[0.08] before:to-blue-400/[0.05] dark:before:from-cyan-400/[0.1] dark:before:via-sky-400/[0.08] dark:before:to-blue-400/[0.05] before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.23,1,0.32,1)] before:pointer-events-none before:z-0 hover:before:scale-x-100",
                                        profile.isDefault
                                            ? "border-green-500/30 shadow-sm bg-green-50/5 dark:bg-green-950/5"
                                            : "border-border shadow-sm hover:border-primary/20",
                                        "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                                    )}
                                    style={{ animationDelay: `${100 + index * 50}ms` }}
                                >
                                    <CardHeader className="p-5 pb-3 relative z-10">
                                        <div className="flex items-center justify-between mb-2">
                                            <CardTitle className="text-lg font-bold leading-tight text-foreground truncate mr-2">
                                                {profile.profileName}
                                            </CardTitle>
                                            {profile.isDefault && (
                                                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-none flex items-center gap-1 shrink-0">
                                                    <CheckCircle className="h-2.5 w-2.5" /> Default Active
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="px-5 pb-5 pt-0 flex-grow relative z-10">
                                        <div className="p-4 rounded-lg border border-border/50 bg-secondary/30 flex flex-col items-center justify-center text-center h-[100px]">
                                            <Building className="h-4 w-4 mb-2 text-muted-foreground/50 transition-transform duration-200 group-hover:-translate-y-[1px]" />
                                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Profile Status</p>
                                            <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 border", statusColor)}>
                                                {status}
                                            </Badge>
                                        </div>
                                    </CardContent>

                                    <div className="px-3 py-3 border-t border-border bg-muted/40 grid gap-1.5 grid-cols-2 sm:[grid-template-columns:0.9fr_1.4fr_0.8fr_0.9fr] items-center relative z-10">
                                        <Button variant="ghost" size="sm" className="w-full min-w-0 font-medium text-xs h-9 px-2.5 rounded-lg transition-all duration-200 hover:-translate-y-[1px] hover:bg-secondary hover:text-secondary-foreground inline-flex items-center justify-center gap-1.5" onClick={() => handleView(profile.id)}>
                                            <Eye className="h-3.5 w-3.5 shrink-0" /> <span className="whitespace-nowrap">View</span>
                                        </Button>
                                        {canManageSettings && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "w-full min-w-0 font-medium text-xs h-9 px-2.5 rounded-lg transition-all duration-200 hover:-translate-y-[1px] inline-flex items-center justify-center gap-1.5",
                                                        profile.isDefault 
                                                            ? "bg-green-600 text-white hover:bg-green-700 hover:text-white shadow-sm" 
                                                            : "hover:bg-secondary hover:text-secondary-foreground"
                                                    )}
                                                    onClick={() => handleSetDefault(profile.id)}
                                                    disabled={profile.isDefault || isSettingDefault !== null}
                                                >
                                                    {isSettingDefault === profile.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                                                    <span className="whitespace-nowrap">{profile.isDefault ? 'Default' : 'Make Default'}</span>
                                                </Button>
                                                <Button variant="ghost" size="sm" className="w-full min-w-0 font-medium text-xs h-9 px-2.5 rounded-lg transition-all duration-200 hover:-translate-y-[1px] hover:bg-secondary hover:text-secondary-foreground inline-flex items-center justify-center gap-1.5" onClick={() => handleEdit(profile.id)}>
                                                    <Edit className="h-3.5 w-3.5 shrink-0" /> <span className="whitespace-nowrap">Edit</span>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full min-w-0 font-medium text-xs h-9 px-2.5 rounded-lg transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground hover:-translate-y-[1px] inline-flex items-center justify-center gap-1.5"
                                                    onClick={() => setPendingDeleteId(profile.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 shrink-0" /> <span className="whitespace-nowrap">Delete</span>
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-card rounded-2xl border-2 border-dashed border-border transition-all flex flex-col items-center">
                        <div className="p-5 bg-secondary/50 rounded-xl mb-5">
                            <Building className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Profile List Empty</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">Add your organization identity to begin operational deployment.</p>
                        <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-6 rounded-lg font-medium text-sm shadow-sm transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 group">
                            <Plus className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" /> Add Constitution
                        </Button>
                    </div>
                )}
            </div>

            <AlertDialog open={pendingDefaultId !== null} onOpenChange={(open) => !open && setPendingDefaultId(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-6">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                            <Shield className="h-6 w-6 text-green-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-bold tracking-tight leading-none uppercase">Transfer Authority?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-medium leading-relaxed pt-1">
                            Executing this command will transfer all primary operational authority to the selected profile. Proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="h-11 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Abort</AlertDialogCancel>
                        <AlertDialogAction
                            className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-green-600/20 active:scale-95 transition-all"
                            onClick={() => pendingDefaultId && executeSetDefault(pendingDefaultId)}
                        >
                            Confirm Transfer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-6">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
                            <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-bold tracking-tight leading-none uppercase">Delete Profile?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-medium leading-relaxed pt-1">
                            Executing this command will permanently destroy this identity across all  servers. This action is final and irrecoverable. Proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="h-11 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                            onClick={async () => {
                                if (pendingDeleteId) {
                                    await deleteProfile(pendingDeleteId);
                                    setPendingDeleteId(null);
                                }
                            }}
                        >
                            Confirm Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
