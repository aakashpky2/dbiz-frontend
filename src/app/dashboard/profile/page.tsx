'use client';
import { PageSkeleton } from '@/components/ui/page-skeleton';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Loader2, Shield, User as UserIcon, Building, BadgeCheck, Calendar, Eye, EyeOff, Lock, Phone, Contact, Copy, Check, Info, Save, X, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DynamicSectionRenderer } from '@/components/dashboard/dynamic-section-renderer';
import { useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api-config';

export default function ProfilePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [profileData, setProfileData] = useState<any>(null);
    const [employeeData, setEmployeeData] = useState<any>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [rolesDisplay, setRolesDisplay] = useState<string[]>([]);
    const [deptName, setDeptName] = useState('Unassigned');
    const [requiredSections, setRequiredSections] = useState<any[]>([]);
    const [dynamicData, setDynamicData] = useState<any>({});
    const [copied, setCopied] = useState(false);

    // Password Change State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    // Visibility Toggles
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Edit Personal Info State
    const [isEditingPersonal, setIsEditingPersonal] = useState(false);
    const [editPhone, setEditPhone] = useState('');
    const [editEmergency, setEditEmergency] = useState('');
    const [isSavingPersonal, setIsSavingPersonal] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // 1. Fetch user_profiles from Supabase
                const { data: userProfile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('uid', user.uid)
                    .maybeSingle();

                setProfileData(userProfile);

                // 2. Fetch employee record
                let empData = null;
                const { data: byHash } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('employee_id_hash', user.uid)
                    .maybeSingle();
                empData = byHash;

                if (!empData && user.email) {
                    const { data: byEmail } = await supabase
                        .from('employees')
                        .select('*')
                        .eq('email', user.email)
                        .maybeSingle();
                    empData = byEmail;
                }

                setEmployeeData(empData);
                if (empData) {
                    setEditPhone(empData.phone_number || userProfile?.phone_number || '');
                    setEditEmergency(empData.emergency_contact || '');
                }

                // 3. Fetch roles
                if (userProfile?.role_ids && Array.isArray(userProfile.role_ids) && userProfile.role_ids.length > 0) {
                    const { data: roles } = await supabase
                        .from('system_roles')
                        .select('id, name')
                        .in('id', userProfile.role_ids);

                    if (roles) {
                        setRolesDisplay(roles.map((r: any) => r.name));
                    }
                }

                // 4. Fetch department name
                if (userProfile?.department_id) {
                    const { data: dept } = await supabase
                        .from('departments')
                        .select('name')
                        .eq('id', userProfile.department_id)
                        .maybeSingle();

                    if (dept) {
                        setDeptName(dept.name);
                    }
                }

                // 5. Fetch required sections from Business Constitutions based on employee's role
                if (empData?.employee_role) {
                    const { data: constitution } = await supabase
                        .from('business_constitutions')
                        .select('required_fields, roles')
                        .ilike('roles->0->roleName', empData.employee_role) 
                        .maybeSingle();

                    if (constitution) {
                        let combinedSections: any[] = [];
                        
                        if (constitution.required_fields && Array.isArray(constitution.required_fields)) {
                            combinedSections = [...constitution.required_fields];
                        }

                        const targetRole = (constitution.roles as any[])?.find(r => r.roleName === empData.employee_role);
                        if (targetRole?.requiredDetails && Array.isArray(targetRole.requiredDetails)) {
                            combinedSections = [...combinedSections, ...targetRole.requiredDetails];
                        }
                        
                        setRequiredSections(combinedSections);
                    }
                }

                // 6. Set dynamic data from employee record
                if (empData?.dynamic_sections) {
                    setDynamicData(empData.dynamic_sections);
                }
            } catch (error) {
            console.error("Error fetching profile:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [user]);

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;

        if (!oldPassword || !newPassword || !confirmPassword) {
            toast({ title: "Error", description: "All password fields are required.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 8) {
            toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
            return;
        }
        if (newPassword === oldPassword) {
            toast({ title: "Error", description: "New password must not be the same as current.", variant: "destructive" });
            return;
        }

        setIsUpdatingPassword(true);

        try {
            // 1. Verify old password securely
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: oldPassword
            });

            if (signInError) {
                toast({ description: "Current password is incorrect.", variant: "destructive" });
                return;
            }

            // 2. Update to new password
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            // 3. Update user_profiles
            const { error: profileErr } = await supabase
                .from('user_profiles')
                .update({ 
                    must_change_password: false, 
                    last_password_reset: new Date().toISOString(),
                    updated_at: new Date().toISOString() 
                })
                .eq('uid', user.uid);
            
            if (profileErr) console.error("Failed to update must_change_password:", profileErr);
            else if (profileData?.must_change_password) {
                setProfileData({ ...profileData, must_change_password: false });
            }

            await queryClient.invalidateQueries({ queryKey: ['userPermissions', user.uid] });

            toast({ title: "Success", description: "Password updated successfully." });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error("Password update error:", error);
            toast({ title: "Error", description: error.message || "Failed to update password. You may need to re-login.", variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleSavePersonalInfo = async () => {
        setIsSavingPersonal(true);
        try {
            if (employeeData?.id) {
                const { error: empError } = await supabase
                    .from('employees')
                    .update({ 
                        phone_number: editPhone,
                        emergency_contact: editEmergency
                    })
                    .eq('id', employeeData.id);
                if (empError) throw empError;
            }

            if (profileData?.id) {
                const { error: profError } = await supabase
                    .from('user_profiles')
                    .update({ phone_number: editPhone })
                    .eq('id', profileData.id);
                if (profError) throw profError;
            }

            // Update local state
            setEmployeeData((prev: any) => ({
                ...prev,
                phone_number: editPhone,
                emergency_contact: editEmergency
            }));
            
            setProfileData((prev: any) => ({
                ...prev,
                phone_number: editPhone
            }));

            toast({ title: "Success", description: "Personal info updated securely." });
            setIsEditingPersonal(false);
        } catch (error: any) {
            console.error("Error saving personal info:", error);
            toast({ title: "Error", description: error.message || "Failed to save data.", variant: "destructive" });
        } finally {
            setIsSavingPersonal(false);
        }
    };

    const handleDynamicDataChange = async (sectionKey: string, fieldKey: string, value: any) => {
        const newData = {
            ...dynamicData,
            [sectionKey]: {
                ...(dynamicData[sectionKey] || {}),
                [fieldKey]: value
            }
        };
        setDynamicData(newData);

        // Update in Supabase immediately for smooth sync
        if (employeeData?.id) {
            try {
                const { error } = await supabase
                    .from('employees')
                    .update({ dynamic_sections: newData })
                    .eq('id', employeeData.id);
                if (error) throw error;
            } catch (err) {
            console.error("Failed to sync dynamic data:", err);
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(user?.uid || '');
        setCopied(true);
        toast({ description: "System ID copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
    };

    const getPasswordStrength = () => {
        if (!newPassword) return 0;
        let score = 0;
        if (newPassword.length > 7) score++;
        if (newPassword.length > 10) score++;
        if (/[A-Z]/.test(newPassword)) score++;
        if (/[0-9]/.test(newPassword)) score++;
        if (/[^A-Za-z0-9]/.test(newPassword)) score++;
        return score; // Max 5
    };

    const strength = getPasswordStrength();
    const strengthColor = 
        strength === 0 ? "bg-slate-200" :
        strength <= 2 ? "bg-red-500" :
        strength <= 3 ? "bg-yellow-500" :
        strength <= 4 ? "bg-green-400" : "bg-green-600";

    if (!user) {
        return <div className="flex items-center justify-center p-12">Please log in to view profile.</div>;
    }

    const photoUrl = employeeData?.photo_url || user.photoURL || profileData?.photo_url || undefined;
    const initials = (user.displayName || employeeData?.full_name || 'U')
        .split(' ').map((n: string) => n.charAt(0)).join('').slice(0, 2).toUpperCase();
    const displayName = user.displayName || employeeData?.full_name || 'User';

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 lg:p-8">
            {profileData?.must_change_password && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex gap-4 items-center">
                        <Shield className="h-6 w-6 shrink-0 text-amber-600" />
                        <p className="text-sm font-medium text-amber-900">
                            Your account is using a temporary password. Please update your password in the Security Center below.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="relative group shrink-0">
                        <Avatar className="h-28 w-28 border-4 border-white shadow-xl">
                            <AvatarImage src={photoUrl} alt={displayName} />
                            <AvatarFallback className="text-3xl font-black bg-slate-100 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        {profileData?.is_department_head ? (
                            <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-full shadow-lg border-4 border-white" title="Department Head">
                                <BadgeCheck className="h-5 w-5" />
                            </div>
                        ) : (
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-4 border-white h-7 w-7 rounded-full shadow-lg" title="Active Account" />
                        )}
                    </div>
                    <div className="flex-grow text-center md:text-left space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{displayName}</h1>
                            {employeeData?.employee_role && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full">
                                    {employeeData.employee_role}
                                </Badge>
                            )}
                        </div>
                        <p className="text-slate-500 font-medium text-lg flex items-center justify-center md:justify-start gap-2">
                            {user.email}
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] uppercase tracking-wider px-3 py-1 flex gap-1.5 items-center">
                                <Building className="h-3 w-3" /> {deptName}
                            </Badge>
                            {rolesDisplay.map((r: string) => (
                                <Badge key={r} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] uppercase tracking-wider px-3 py-1">
                                    {r}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                
                {/* Left Column: Info Cards */}
                <div className="lg:col-span-7 space-y-8">
                    
                    {/* ── Organizational Information (Read Only) ── */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4 px-6 pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <Building className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-900">Organizational Info</CardTitle>
                                        <CardDescription className="text-sm font-medium text-slate-500">Official workplace details.</CardDescription>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 py-6 space-y-6">
                            {isLoadingData ? (
                                <div className="p-6"><PageSkeleton /></div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</p>
                                        <p className="font-semibold text-slate-900">{displayName || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Official Email</p>
                                        <p className="font-semibold text-slate-900 truncate" title={user.email}>{user.email || '-'}</p>
                                    </div>
                                    {deptName && deptName !== 'Unassigned' && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
                                            <p className="font-semibold text-slate-900">{deptName}</p>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</p>
                                        <p className="font-semibold text-slate-900">{employeeData?.employee_role || '-'}</p>
                                    </div>
                                    {employeeData?.joining_date && (
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Joining Date</p>
                                            <p className="font-semibold text-slate-900">
                                                {new Date(employeeData.joining_date).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="bg-slate-50 border-t border-slate-100 py-3 px-6 flex items-start gap-2">
                            <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-500 font-medium">To update official details, please contact HR/Admin.</p>
                        </CardFooter>
                    </Card>

                    {/* ── Personal Information (Editable) ── */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden relative">
                        <CardHeader className="bg-white border-b border-slate-100 pb-4 px-6 pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                                        <UserIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-900">Personal Info</CardTitle>
                                        <CardDescription className="text-sm font-medium text-slate-500">Manage your private contact details.</CardDescription>
                                    </div>
                                </div>
                                {!isEditingPersonal && (
                                    <Button variant="outline" size="sm" onClick={() => setIsEditingPersonal(true)} className="h-9 px-4 font-semibold rounded-xl">
                                        <Edit3 className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 py-6 space-y-6">
                            {isLoadingData ? (
                                <div className="p-6"><PageSkeleton /></div>
                            ) : (
                                <div className="space-y-6">
                                    {isEditingPersonal ? (
                                        <div className="space-y-5 animate-in fade-in">
                                            <div className="space-y-2">
                                                <Label htmlFor="editPhone" className="text-sm font-bold text-slate-700">Phone Number</Label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input 
                                                        id="editPhone" 
                                                        value={editPhone} 
                                                        onChange={(e) => setEditPhone(e.target.value)} 
                                                        className="pl-10 rounded-xl border-slate-200 h-11"
                                                        placeholder="+91 9876543210"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="editEmergency" className="text-sm font-bold text-slate-700">Emergency Contact</Label>
                                                <div className="relative">
                                                    <Contact className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input 
                                                        id="editEmergency" 
                                                        value={editEmergency} 
                                                        onChange={(e) => setEditEmergency(e.target.value)} 
                                                        className="pl-10 rounded-xl border-slate-200 h-11"
                                                        placeholder="Name - Phone"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-slate-500 font-medium ml-1">Who to contact in case of emergency.</p>
                                            </div>
                                            <div className="flex items-center gap-3 pt-2">
                                                <Button onClick={handleSavePersonalInfo} disabled={isSavingPersonal} className="flex-1 rounded-xl h-11 font-bold">
                                                    {isSavingPersonal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                    Save Changes
                                                </Button>
                                                <Button variant="outline" onClick={() => {
                                                    setIsEditingPersonal(false);
                                                    setEditPhone(employeeData?.phone_number || profileData?.phone_number || '');
                                                    setEditEmergency(employeeData?.emergency_contact || '');
                                                }} disabled={isSavingPersonal} className="rounded-xl h-11 font-bold">
                                                    <X className="h-4 w-4 mr-2" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 animate-in fade-in">
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                                                <p className="font-semibold text-slate-900 flex items-center gap-2">
                                                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                    {employeeData?.phone_number || profileData?.phone_number || <span className="text-slate-400 italic font-normal">Not provided</span>}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Emergency Contact</p>
                                                <p className="font-semibold text-slate-900 flex items-center gap-2">
                                                    <Contact className="h-4 w-4 text-slate-400" />
                                                    {employeeData?.emergency_contact || <span className="text-slate-400 italic font-normal">Not provided</span>}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Dynamic Constitution Sections ── */}
                    {requiredSections.length > 0 && (
                        <div className="pt-2">
                            <DynamicSectionRenderer 
                                sections={requiredSections} 
                                data={dynamicData} 
                                onDataChange={handleDynamicDataChange}
                            />
                        </div>
                    )}

                </div>

                {/* Right Column: Security */}
                <div className="lg:col-span-5">
                    {/* ── Security Card ── */}
                    <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden sticky top-6">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4 px-6 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-900">Security Center</CardTitle>
                                    <CardDescription className="text-sm font-medium text-slate-500">Update your credentials securely.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 py-6">
                            <form onSubmit={handlePasswordUpdate} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="old-pass" className="text-sm font-bold text-slate-700">Current Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="old-pass"
                                            type={showOldPassword ? "text" : "password"}
                                            className="pl-10 pr-10 h-11 rounded-xl border-slate-200"
                                            placeholder="Enter current password"
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            required
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPassword(!showOldPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-pass" className="text-sm font-bold text-slate-700">New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="new-pass"
                                            type={showNewPassword ? "text" : "password"}
                                            className="pl-10 pr-10 h-11 rounded-xl border-slate-200"
                                            placeholder="At least 8 characters"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {newPassword && (
                                        <div className="flex gap-1 pt-1.5 px-1">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthColor : "bg-slate-100 transition-colors"}`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 pb-2">
                                    <Label htmlFor="confirm-pass" className="text-sm font-bold text-slate-700">Confirm New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="confirm-pass"
                                            type={showConfirmPassword ? "text" : "password"}
                                            className="pl-10 pr-10 h-11 rounded-xl border-slate-200"
                                            placeholder="Re-enter new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-11 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white" disabled={isUpdatingPassword}>
                                    {isUpdatingPassword ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Shield className="mr-2 h-4 w-4" />
                                    )}
                                    Update Password
                                </Button>

                                <p className="text-[11px] text-slate-500 font-medium text-center leading-relaxed">
                                    Use a strong password combining letters, numbers, and symbols. You may be asked to sign in again.
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
