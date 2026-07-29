
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
        <div className="space-y-6 pb-12 animate-in fade-in duration-700">
            <div className="relative overflow-hidden bg-white border rounded-2xl p-6 shadow-md">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl animate-pulse" />
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-primary/10 rounded-xl shadow-inner ring-1 ring-primary/20 backdrop-blur-sm">
                            <Building className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[9px] font-bold uppercase tracking-wide px-2">Management Portal</Badge>
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-tight mb-1 uppercase text-slate-900">Business Profiles</h1>
                            <p className="text-muted-foreground font-medium text-sm leading-relaxed max-w-lg">
                                Manage and view all Business Profiles
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <CompanyBrandingDialog />
                        {canManageSettings && (
                            <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md transition-all active:scale-95 group">
                                <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" /> Create New Profile
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all duration-300 rounded-xl">
                    <div className="h-1 w-full bg-primary" />
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Active Profiles</p>
                            <p className="text-2xl font-bold tabular-nums tracking-tight">{profiles.length}</p>
                        </div>
                        <div className="p-2.5 bg-primary/10 text-primary rounded-lg group-hover:scale-105 transition-all duration-500 border border-primary/5">
                            <Building className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all duration-300 rounded-xl">
                    <div className="h-1 w-full bg-emerald-500" />
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Default</p>
                            <p className="text-2xl font-bold tabular-nums tracking-tight">{profiles.filter(p => p.isDefault).length}</p>
                        </div>
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg group-hover:scale-105 transition-all duration-500 border border-emerald-500/5">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all duration-300 rounded-xl">
                    <div className="h-1 w-full bg-purple-500" />
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Constitutions</p>
                            <p className="text-2xl font-bold tabular-nums tracking-tight">{constitutions.length}</p>
                        </div>
                        <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-lg group-hover:scale-105 transition-all duration-500 border border-purple-500/5">
                            <Edit className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background">
                    <DialogHeader className="border-b p-6 pb-4 shrink-0 bg-slate-50/50">
                        <DialogTitle className="text-xl font-bold">{editingProfileId ? 'Update Profile' : 'Create New Profile'}</DialogTitle>
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

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <div className="h-1.5 w-1.5 bg-primary rounded-full shadow-sm" />
                    <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Entity Registry</h2>
                </div>

                {sortedProfiles.length > 0 ? (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {sortedProfiles.map((profile: Profile) => {
                            const constitution = constitutions.find(c => c.id === profile.constitutionId);
                            const status = getProfileConfigurationStatus(profile, constitution);
                            let statusColor = "bg-red-100 text-red-700 hover:bg-red-100";
                            if (status === "Configured") statusColor = "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
                            else if (status === "Partially Configured") statusColor = "bg-amber-100 text-amber-700 hover:bg-amber-100";

                            return (
                                <Card
                                    key={profile.id}
                                    className={cn(
                                        "relative group overflow-hidden border transition-all duration-500 rounded-xl flex flex-col",
                                        profile.isDefault
                                            ? "border-emerald-500/30 bg-emerald-50/5 shadow-md ring-1 ring-emerald-500/5"
                                            : "border-gray-100 hover:border-primary/30 hover:shadow-lg bg-white"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full transition-all duration-700 group-hover:scale-150",
                                        profile.isDefault ? "bg-emerald-500" : "bg-primary"
                                    )} />

                                    {profile.isDefault && (
                                        <div className="absolute top-0 left-0 z-10 w-full">
                                            <div className="bg-emerald-600 text-white px-4 py-1.5 font-bold text-[9px] uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-sm">
                                                <CheckCircle className="h-2.5 w-2.5" /> Global Default Active
                                            </div>
                                        </div>
                                    )}

                                    <CardHeader className={cn("pb-4 px-6 relative z-10", profile.isDefault ? "pt-12" : "pt-6")}>
                                        <CardTitle className={cn("text-xl font-bold transition-colors duration-500 leading-tight tracking-tight", profile.isDefault ? "text-emerald-950" : "group-hover:text-primary")}>
                                            {profile.profileName}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="px-6 pb-4 flex-grow relative z-10">
                                        <div className={cn("p-4 rounded-xl border border-dashed transition-all duration-500 flex flex-col items-center justify-center text-center", profile.isDefault ? "bg-emerald-500/5 border-emerald-500/10" : "bg-gray-50 group-hover:bg-white border-gray-100")}>
                                            <Building className={cn("h-5 w-5 mb-2 opacity-20", profile.isDefault ? "text-emerald-500" : "text-muted-foreground")} />
                                            <p className={cn("text-[8px] font-bold uppercase tracking-wide mb-1 opacity-50")}>Profile Status</p>
                                            <Badge variant="secondary" className={cn("mt-1 text-[10px] font-extrabold uppercase tracking-widest px-3 py-0.5", statusColor)}>
                                                {status}
                                            </Badge>
                                        </div>
                                    </CardContent>

                                    <div className={cn("px-3 py-3 border-t border-dashed flex justify-end gap-2 relative z-10", profile.isDefault ? "bg-emerald-50/30 border-emerald-500/10" : "border-gray-100 bg-gray-50/50")}>
                                        <Button variant="ghost" size="sm" className="font-bold text-[8px] uppercase tracking-wide h-9 rounded-lg transition-all hover:bg-indigo-500/10 hover:text-indigo-600" onClick={() => handleView(profile.id)}>
                                            <Eye className="h-3.5 w-3.5 md:mr-1.5" /> <span className="hidden md:inline">View</span>
                                        </Button>
                                        {canManageSettings && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "font-bold text-[8px] uppercase tracking-wide h-9 rounded-lg transition-all",
                                                        profile.isDefault ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" : "hover:bg-emerald-500/10 hover:text-emerald-600"
                                                    )}
                                                    onClick={() => handleSetDefault(profile.id)}
                                                    disabled={profile.isDefault || isSettingDefault !== null}
                                                    title={profile.isDefault ? 'Default' : 'Make Default'}
                                                    aria-label={profile.isDefault ? 'Default profile' : 'Make profile default'}
                                                >
                                                    {isSettingDefault === profile.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 md:mr-1.5" />}
                                                    <span className="hidden md:inline">{profile.isDefault ? 'Default' : 'Make Default'}</span>
                                                </Button>
                                                <Button variant="ghost" size="sm" className="font-bold text-[8px] uppercase tracking-wide h-9 rounded-lg transition-all hover:bg-blue-500/10 hover:text-blue-600" onClick={() => handleEdit(profile.id)}>
                                                    <Edit className="h-3.5 w-3.5 md:mr-1.5" /> <span className="hidden md:inline">Edit</span>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="font-bold text-[8px] uppercase tracking-wide h-9 rounded-lg transition-all hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => setPendingDeleteId(profile.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 md:mr-1.5" /> <span className="hidden md:inline">Delete</span>
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 transition-all flex flex-col items-center">
                        <div className="p-6 bg-white rounded-full shadow-lg mb-6 animate-pulse">
                            <Building className="h-10 w-10 text-primary/30" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-400 uppercase tracking-widest">Profile List Empty</h3>
                        <p className="text-xs text-gray-400 mt-2 font-semibold uppercase tracking-wide max-w-xs">Add your organization identity to begin operational deployment.</p>
                        <Button onClick={handleCreateNew} className="mt-8 bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md">
                            <Plus className="mr-2 h-4 w-4" /> Add Constitution
                        </Button>
                    </div>
                )}
            </div>

            <AlertDialog open={pendingDefaultId !== null} onOpenChange={(open) => !open && setPendingDefaultId(null)}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl p-6">
                    <AlertDialogHeader>
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                            <Shield className="h-6 w-6 text-emerald-600" />
                        </div>
                        <AlertDialogTitle className="text-2xl font-bold tracking-tight leading-none uppercase">Transfer Authority?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-medium leading-relaxed pt-1">
                            Executing this command will transfer all primary operational authority to the selected profile. Proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="h-11 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Abort</AlertDialogCancel>
                        <AlertDialogAction
                            className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
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
