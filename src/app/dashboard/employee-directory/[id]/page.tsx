'use client';
import { PageSkeleton } from '@/components/ui/page-skeleton';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Home, Phone, HeartPulse, Briefcase, Mail, Building, Calendar, Edit, Trash2, ArrowLeft, Clock, CalendarDays, Wallet, UserCheck, Star, Landmark, UserMinus, AlertTriangle, CheckCircle, XCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { logAuditAction } from '@/lib/audit-logger';
import { DynamicSectionRenderer } from '@/components/dashboard/dynamic-section-renderer';
import { MetadataPanel } from '@/components/common/metadata-panel';
import { Printer } from 'lucide-react';

const DEFAULT_LAT = 8.504391287203669;
const DEFAULT_LNG = 76.96805215217263;

const isValuePresent = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
};

const DetailItem = ({ icon: Icon, label, value, highlightCondition = false }: { icon: React.ElementType, label: string, value?: string | number | null, highlightCondition?: boolean }) => {
    return (
        <div className={cn(
            "flex items-start gap-3 p-2 rounded-md transition-colors",
            highlightCondition && "bg-yellow-100 dark:bg-yellow-900/20"
        )}>
            <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
            <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className={cn(
                    "text-base text-foreground",
                    !isValuePresent(value) && "text-muted-foreground italic",
                    highlightCondition && "text-yellow-800 dark:text-yellow-300 font-semibold"
                )}>
                    {isValuePresent(value) ? value : (highlightCondition ? 'Not Set' : 'N/A')}
                </p>
            </div>
        </div>
    );
};

export default function EmployeeProfilePage() {
    const [employee, setEmployee] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

    const { user: currentUser } = useAuth();

    const [requiredSections, setRequiredSections] = useState<any[]>([]);
    const [dynamicData, setDynamicData] = useState<any>({});

    // Resignation State
    const [isResigning, setIsResigning] = useState(false);
    const [showResignDialog, setShowResignDialog] = useState(false);
    const [resignationDate, setResignationDate] = useState('');
    const [resignConfirmationText, setResignConfirmationText] = useState('');

    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const employeeId = params.id as string;

    useEffect(() => {
        const fetchEmployee = async () => {
            if (!employeeId) return;
            setLoading(true);
            try {
                const response = await fetch(`/api/employees/${employeeId}`);
                const result = await response.json();

                if (!result.success || !result.data) {
                    setEmployee(null);
                    setLoading(false);
                    return;
                }

                const data = result.data;
                // Since our backend /api/employees/:id already returns a beautifully mapped 
                // structure that matches our frontend needs almost exactly, we use it directly.
                // We just need to ensure some fields are correctly shaped for the detail items.
                
                setEmployee(data);
                
                // Fetch required sections if role exists
                if (data.personalDetails?.employeeRole) {
                    const { data: constitution } = await supabase
                        .from('business_constitutions')
                        .select('required_fields, roles')
                        .ilike('roles->0->roleName', data.personalDetails.employeeRole)
                        .maybeSingle();

                    if (constitution) {
                        setRequiredSections(constitution.required_fields || []);
                    }
                }
                
                setLoading(false);
            } catch (error) {
            console.error('Error fetching employee:', error);
                setLoading(false);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Operation failed",
                variant: "destructive"
            });
        
        }
        };

        fetchEmployee();
    }, [employeeId]);
    const personalDetails = employee?.personalDetails || {};
    const addressDetails = employee?.addressDetails || {};
    const employmentDetails = employee?.employmentDetails || {};
    const emergencyContact = employee?.emergencyContact || { primaryContact: {}, secondaryContact: {} };
    const medicalInfo = employee?.medicalInfo || { healthIssues: [] };
    const bankDetails = employee?.bankDetails || {};
    const qualifications = employee?.qualificationDetails || [];
    const qualificationDetails = Array.isArray(qualifications) ? qualifications[0] : {};
    
    // Destructured variables for UI
    const permanentAddress = addressDetails.permanentAddress || {};
    const currentAddress = addressDetails.currentAddress || {};

    const executeDelete = async () => {
        if (!employee) return;
        setIsDeleting(true);
        try {
            // Use the backend DELETE /api/employees/:id route
            // This performs a hard delete of the employee and all child records
            const res = await fetch(`/api/employees/${employee.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                // Surface the real error message from the backend
                let errMsg = 'Failed to delete employee';
                try {
                    const errData = await res.json();
                    errMsg = errData.error || errData.message || errMsg;
                } catch (_) {
            
            toast({
                title: "Error",
                description: _ instanceof Error ? _.message : "Operation failed",
                variant: "destructive"
            });
        
        }
                throw new Error(errMsg);
            }

            toast({
                title: "Employee Deleted",
                description: `${employee.personalDetails.fullName} has been permanently removed.`,
            });
            const { clearCache } = await import('@/lib/fetcher');
            clearCache();
            router.push('/dashboard/employee-directory');
        } catch (error: any) {
            console.error("Error deleting employee:", error);
            toast({
                title: "Delete Failed",
                description: error.message,
                variant: "destructive",
            });
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const executeResignation = async () => {
        if (!employee || !resignationDate) return;
        setIsResigning(true);
        try {
            const res = await fetch(`/api/employees/${employee.id}/resign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resignationDate })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || errData.message || 'Failed to resign employee');
            }

            // Invalidate the cache
            const { clearCache } = await import('@/lib/fetcher');
            clearCache();

            setEmployee((prev: any) => ({
                ...prev,
                isResigned: true,
                resignationDate: resignationDate
            }));

            toast({
                title: "Employee Resigned",
                description: `${employee.personalDetails.fullName} has been marked as resigned.`,
            });
        } catch (error: any) {
            console.error("Error marking resignation:", error);
            toast({ title: "Action Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsResigning(false);
            setShowResignDialog(false);
            setResignationDate('');
            setResignConfirmationText('');
        }
    };

    const executeCancelResignation = async () => {
        if (!employee) return;
        setIsResigning(true);
        try {
            const res = await fetch(`/api/employees/${employee.id}/cancel-resign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || errData.message || 'Failed to cancel resignation');
            }

            // Invalidate the cache
            const { clearCache } = await import('@/lib/fetcher');
            clearCache();

            setEmployee((prev: any) => ({
                ...prev,
                isResigned: false,
                resignationDate: null
            }));

            toast({
                title: "Resignation Cancelled",
                description: `${employee.personalDetails.fullName} is now active again.`,
            });
        } catch (error: any) {
            console.error("Error cancelling resignation:", error);
            toast({ title: "Action Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsResigning(false);
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

        if (employeeId) {
            try {
                const { error } = await supabase
                    .from('employees')
                    .update({ dynamic_sections: newData })
                    .eq('id', employeeId);
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


    if (loading) {
        return <div className="p-6"><PageSkeleton /></div>;
    }

    if (!employee) {
        return <div className="text-center mt-10">Employee not found.</div>;
    }



    const fullPermanentAddress = [
        addressDetails.permanentAddress.buildingHouseNo,
        addressDetails.permanentAddress.buildingApartmentName,
        addressDetails.permanentAddress.streetArea,
        addressDetails.permanentAddress.cityTownVillage,
        addressDetails.permanentAddress.district,
        addressDetails.permanentAddress.stateProvince,
        addressDetails.permanentAddress.country,
        addressDetails.permanentAddress.pincode,
    ].filter(Boolean).join(', ');

    const currentAddressSource = addressDetails.isCurrentSameAsPermanent ? addressDetails.permanentAddress : addressDetails.currentAddress;
    const fullCurrentAddress = [
        currentAddressSource?.buildingHouseNo,
        currentAddressSource?.buildingApartmentName,
        currentAddressSource?.streetArea,
        currentAddressSource?.cityTownVillage,
        currentAddressSource?.district,
        currentAddressSource?.stateProvince,
        currentAddressSource?.country,
        currentAddressSource?.pincode,
    ].filter(Boolean).join(', ');


    return (
        <>
            <div className="p-4 space-y-6">
                <div className="flex justify-start mb-4">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/employee-directory">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Directory
                        </Link>
                    </Button>
                </div>
                <Card className="shadow-lg">
                    <CardHeader className="bg-muted/30">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-24 w-24 border-4 border-primary">
                                    <AvatarImage src={personalDetails?.photo} alt={personalDetails?.fullName || 'Employee'} />
                                    <AvatarFallback>{(personalDetails?.fullName || 'E').split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-3xl">{personalDetails?.fullName || 'Unnamed Employee'}</CardTitle>
                                    <CardDescription className="text-lg text-primary">{employmentDetails?.employeeRole || 'No Role Assigned'}</CardDescription>
                                    <p className="text-sm text-muted-foreground">Employee ID: {employmentDetails?.employeeId || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {employee?.isResigned ? (
                                    <>
                                        <Badge variant="destructive" className="h-10 px-4 text-base bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                                            RESIGNED
                                        </Badge>
                                        <Button
                                            variant="outline"
                                            className="text-muted-foreground border-muted-foreground/30 hover:bg-muted/10 hover:text-foreground"
                                            onClick={executeCancelResignation}
                                            disabled={isResigning}
                                        >
                                            {isResigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                            Undo Resignation
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => setShowResignDialog(true)}>
                                        <UserMinus className="mr-2 h-4 w-4" /> Mark as Resigned
                                    </Button>
                                )}
                                <Button asChild variant="outline" className="print:hidden">
                                    <Link href={`/dashboard/employee-directory/${employee?.id}/edit`}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                                    </Link>
                                </Button>
                                <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                </Button>
                                <Button variant="destructive" className="print:hidden" onClick={() => setShowDeleteConfirm(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Employee
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-5 gap-8">
                        {/* Personal Details */}
                        <div className="space-y-1 lg:col-span-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><User /> Personal Details</h3>
                            <Separator />
                            <DetailItem icon={Mail} label="Email" value={personalDetails?.email} highlightCondition={!isValuePresent(personalDetails?.email)} />
                            <DetailItem icon={Phone} label="Phone" value={personalDetails?.phoneNumber ? `${personalDetails.phoneCountryCode || '+91'} ${personalDetails.phoneNumber}` : null} highlightCondition={!isValuePresent(personalDetails?.phoneNumber)} />
                            <DetailItem icon={Calendar} label="Date of Birth" value={personalDetails?.dateOfBirth ? format(new Date(personalDetails.dateOfBirth), 'dd MMM, yyyy') : null} highlightCondition={!isValuePresent(personalDetails?.dateOfBirth)} />
                            <DetailItem icon={User} label="Gender" value={personalDetails?.gender} highlightCondition={!isValuePresent(personalDetails?.gender)} />
                            <DetailItem icon={HeartPulse} label="Marital Status" value={personalDetails?.maritalStatus} highlightCondition={!isValuePresent(personalDetails?.maritalStatus)} />
                            <DetailItem icon={Calendar} label="Joining Date" value={personalDetails?.joiningDate ? format(new Date(personalDetails.joiningDate), 'dd MMM, yyyy') : null} highlightCondition={!isValuePresent(personalDetails?.joiningDate)} />
                        </div>

                        {/* Address Details */}
                        <div className="space-y-1 lg:col-span-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><Home /> Address Details</h3>
                            <Separator />
                            <DetailItem icon={UserCheck} label="Aadhar Number" value={addressDetails?.permanentAddress?.aadharNumber} highlightCondition={!isValuePresent(addressDetails?.permanentAddress?.aadharNumber)} />
                            <DetailItem icon={Home} label="Permanent Address" value={fullPermanentAddress} highlightCondition={!isValuePresent(fullPermanentAddress)} />
                            <DetailItem icon={Home} label="Current Address" value={fullCurrentAddress} highlightCondition={!addressDetails?.isCurrentSameAsPermanent && !isValuePresent(fullCurrentAddress)} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                <DetailItem icon={UserCheck} label="Latitude" value={addressDetails?.permanentAddress?.latitude} highlightCondition={!isValuePresent(addressDetails?.permanentAddress?.latitude)} />
                                <DetailItem icon={UserCheck} label="Longitude" value={addressDetails?.permanentAddress?.longitude} highlightCondition={!isValuePresent(addressDetails?.permanentAddress?.longitude)} />
                            </div>
                        </div>

                        <Separator className="lg:col-span-5" />

                        {/* Emergency Contacts */}
                        <div className="lg:col-span-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><Phone /> Emergency Contacts</h3>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 pt-2">
                                <div>
                                    <p className="font-medium px-2 pt-2 text-md">Primary</p>
                                    <DetailItem icon={User} label="Name" value={emergencyContact?.primaryContact?.name} highlightCondition={!isValuePresent(emergencyContact?.primaryContact?.name)} />
                                    <DetailItem icon={Phone} label="Phone" value={emergencyContact?.primaryContact?.phoneNumber} highlightCondition={!isValuePresent(emergencyContact?.primaryContact?.phoneNumber)} />
                                    <DetailItem icon={User} label="Relation" value={emergencyContact?.primaryContact?.relation} highlightCondition={!isValuePresent(emergencyContact?.primaryContact?.relation)} />
                                </div>
                                <div>
                                    <p className="font-medium px-2 pt-2 text-md">Secondary</p>
                                    <DetailItem icon={User} label="Name" value={emergencyContact?.secondaryContact?.name} highlightCondition={!!emergencyContact?.secondaryContact?.phoneNumber && !emergencyContact?.secondaryContact?.name} />
                                    <DetailItem icon={Phone} label="Phone" value={emergencyContact?.secondaryContact?.phoneNumber} highlightCondition={!!emergencyContact?.secondaryContact?.name && !emergencyContact?.secondaryContact?.phoneNumber} />
                                    <DetailItem icon={User} label="Relation" value={emergencyContact?.secondaryContact?.relation} highlightCondition={!!emergencyContact?.secondaryContact?.name && !emergencyContact?.secondaryContact?.relation} />
                                </div>
                            </div>
                        </div>


                        <Separator className="lg:col-span-5" />

                        {/* Employment & Medical Details */}
                        <div className="space-y-1 lg:col-span-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><Briefcase /> Employment Details</h3>
                            <Separator />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                <DetailItem icon={Briefcase} label="Job Title" value={employmentDetails?.jobTitle} highlightCondition={!isValuePresent(employmentDetails?.jobTitle)} />
                                {employee?.isResigned && (
                                    <DetailItem
                                        icon={Calendar}
                                        label="Resignation Date"
                                        value={employee?.resignationDate ? format(new Date(employee.resignationDate), 'dd MMM, yyyy') : 'Not Set'}
                                        highlightCondition={true}
                                    />
                                )}
                                <DetailItem icon={Star} label="Employment Term" value={`${employmentDetails?.employmentTermYears || 0} years, ${employmentDetails?.employmentTermMonths || 0} months`} highlightCondition={(!isValuePresent(employmentDetails?.employmentTermYears) || employmentDetails?.employmentTermYears === 0) && (!isValuePresent(employmentDetails?.employmentTermMonths) || employmentDetails?.employmentTermMonths === 0)} />
                                <DetailItem icon={Calendar} label="Relieving Date" value={employmentDetails?.relievingDate ? format(new Date(employmentDetails.relievingDate), 'dd MMM, yyyy') : null} highlightCondition={!isValuePresent(employmentDetails?.relievingDate) && (employmentDetails?.employmentTermYears || 0) > 0} />
                                <DetailItem icon={Wallet} label="Salary" value={employmentDetails?.monthlySalary ? `₹${employmentDetails.monthlySalary.toLocaleString()}/month` : null} highlightCondition={!employmentDetails?.monthlySalary || employmentDetails?.monthlySalary === 0} />
                                <DetailItem icon={CalendarDays} label="Casual Leaves" value={isValuePresent(employmentDetails?.casualLeavesPerMonth) ? `${employmentDetails.casualLeavesPerMonth} per month` : null} highlightCondition={!isValuePresent(employmentDetails?.casualLeavesPerMonth)} />
                                <DetailItem icon={CalendarDays} label="Sick Leaves" value={isValuePresent(employmentDetails?.sickLeavesPerMonth) ? `${employmentDetails.sickLeavesPerMonth} per month` : null} highlightCondition={!isValuePresent(employmentDetails?.sickLeavesPerMonth)} />
                                <DetailItem icon={Clock} label="Start Time" value={employmentDetails?.startTime} highlightCondition={!isValuePresent(employmentDetails?.startTime)} />
                                <DetailItem icon={Clock} label="End Time" value={employmentDetails?.endTime} highlightCondition={!isValuePresent(employmentDetails?.endTime)} />
                                <div className="sm:col-span-2 p-2 rounded-md">
                                    <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Working Days</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(employmentDetails?.workingDays && employmentDetails.workingDays.length > 0) ? (
                                            employmentDetails.workingDays.map((day: string) => (
                                                <Badge key={day} variant="secondary">{day.charAt(0).toUpperCase() + day.slice(1)}</Badge>
                                            ))
                                        ) : (
                                            <Badge variant="destructive">Not Set</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1 lg:col-span-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><HeartPulse /> Medical Info</h3>
                            <Separator />
                            <DetailItem icon={HeartPulse} label="Blood Group" value={medicalInfo?.bloodGroup} highlightCondition={!isValuePresent(medicalInfo?.bloodGroup)} />
                            <div className="p-2 rounded-md">
                                <p className="text-sm font-medium text-muted-foreground">Health Issues</p>
                                {(medicalInfo.healthIssues?.length || 0) > 0 ? (
                                    <ul className="list-disc pl-5 text-sm text-foreground">
                                        {medicalInfo.healthIssues.map((issue: any, index: number) => <li key={index}>{issue.name} {issue.details && `(${issue.details})`}</li>)}
                                    </ul>
                                ) : <p className="text-sm text-foreground">N/A</p>}
                            </div>
                        </div>

                        <Separator className="lg:col-span-5" />

                        {/* Education / Qualification Details */}
                        <div className="space-y-1 lg:col-span-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><GraduationCap /> Education Details</h3>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 pt-2">
                                <DetailItem icon={GraduationCap} label="Qualification" value={qualificationDetails?.highestQualification} highlightCondition={!isValuePresent(qualificationDetails?.highestQualification)} />
                                <DetailItem icon={Building} label="Institution" value={qualificationDetails?.institutionName} highlightCondition={!isValuePresent(qualificationDetails?.institutionName)} />
                                <DetailItem icon={Briefcase} label="Specialization" value={qualificationDetails?.specialization} highlightCondition={!isValuePresent(qualificationDetails?.specialization)} />
                            </div>
                        </div>

                        <Separator className="lg:col-span-5" />

                        {/* Bank Details */}
                        <div className="space-y-1 lg:col-span-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary p-2"><Landmark /> Bank Account Details</h3>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 pt-2">
                                <DetailItem icon={User} label="Account Holder Name" value={bankDetails?.accountHolderName} highlightCondition={!isValuePresent(bankDetails?.accountHolderName)} />
                                <DetailItem icon={Wallet} label="Account Number" value={bankDetails?.accountNumber} highlightCondition={!isValuePresent(bankDetails?.accountNumber)} />
                                <DetailItem icon={Building} label="IFSC Code" value={bankDetails?.ifscCode} highlightCondition={!isValuePresent(bankDetails?.ifscCode)} />
                                <DetailItem icon={Home} label="Bank Branch" value={bankDetails?.bankBranch} highlightCondition={!isValuePresent(bankDetails?.bankBranch)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="print:hidden">
                    <MetadataPanel 
                        createdBy={employee?.created_by_name || (employee?.created_by ? "System User" : undefined)}
                        createdOn={employee?.created_at ? format(new Date(employee.created_at), 'dd MMM yyyy, p') : undefined}
                        updatedBy={employee?.updated_by_name || (employee?.updated_by ? "System User" : undefined)}
                        updatedOn={employee?.updated_at ? format(new Date(employee.updated_at), 'dd MMM yyyy, p') : undefined}
                    />
                </div>

                <div className="pt-4 print:hidden">
                    <DynamicSectionRenderer 
                        sections={requiredSections} 
                        data={dynamicData} 
                        onDataChange={handleDynamicDataChange}
                    />
                </div>
            </div>

            {/* Resignation Dialog */}
            <AlertDialog open={showResignDialog} onOpenChange={setShowResignDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-5 w-5" /> Confirm Resignation
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to mark <strong className="text-foreground">{personalDetails.fullName}</strong> as resigned.
                            This will update their status in the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Resignation Date</label>
                            <Input
                                type="date"
                                value={resignationDate}
                                onChange={(e) => setResignationDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Confirmation</label>
                            <Input
                                type="text"
                                value={resignConfirmationText}
                                onChange={(e) => setResignConfirmationText(e.target.value)}
                                placeholder='Type "RESIGNED" to confirm'
                            />
                            <p className="text-xs text-muted-foreground">Type <strong>RESIGNED</strong> to enable the button.</p>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setResignationDate('');
                            setResignConfirmationText('');
                            setShowResignDialog(false);
                        }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeResignation}
                            disabled={isResigning || !resignationDate || resignConfirmationText !== 'RESIGNED'}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {isResigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Mark as Resigned
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the employee profile for <strong className="text-foreground">{personalDetails.fullName}</strong>. To confirm, please type <strong>delete</strong> in the box below.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        type="text"
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        placeholder='Type "delete" to confirm'
                        className="mt-2"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmationText('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDelete}
                            disabled={isDeleting || deleteConfirmationText.toLowerCase() !== 'delete'}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
