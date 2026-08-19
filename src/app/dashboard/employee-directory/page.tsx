'use client';
import { PageSkeleton } from '@/components/ui/page-skeleton';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Search, Download, Loader2, UserPlus, Eye, AlertCircle, Users, UserMinus, Filter, Building, MapPin } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useMemo } from "react";
// Removed top-level imports of jsPDF and html2canvas for faster initial bundle loading
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithCache } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/dashboard/page-hero";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { usePermissions } from "@/hooks/use-permissions";
import { useRouter } from "next/navigation";

import { FileText as TemplateIcon } from "lucide-react";
import dynamic from 'next/dynamic';

const UseTemplateModal = dynamic(() => import('@/features/templates/components/UseTemplateModal'), {
  ssr: false,
});

type PersonalDetails = {
  fullName: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  photo: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
};

type AddressDetails = {
  permanentAddress: {
    buildingHouseNo?: string;
    buildingApartmentName?: string;
    streetArea?: string;
    cityTownVillage: string;
    country: string;
    stateProvince: string;
    district?: string;
    pincode?: string;
    aadharNumber?: string;
    latitude?: number;
    longitude?: number;
  };
  currentAddress?: {
    buildingHouseNo?: string;
    buildingApartmentName?: string;
    streetArea?: string;
    cityTownVillage: string;
    country: string;
    stateProvince: string;
    district?: string;
    pincode?: string;
  };
  isCurrentSameAsPermanent?: boolean;
};

type EmploymentDetails = {
  employeeId: string;
  jobTitle?: string;
  employeeRole: string;
  department?: string;
  joiningDate?: string;
  monthlySalary?: number;
};

type EmployeeProfile = {
  id: string;
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  employmentDetails: EmploymentDetails;
  completionPercentage?: number;
  emergencyContact?: any;
  medicalInfo?: any;
  bankDetails?: any;
  isResigned?: boolean;
};

export default function EmployeeDirectoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageEmployees = hasPermission('MANAGE_EMPLOYEES');
  const canViewDirectory = hasPermission('VIEW_EMPLOYEE_DIRECTORY') || canManageEmployees;

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  
  // Use Template State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedEmployeeForTemplate, setSelectedEmployeeForTemplate] = useState<EmployeeProfile | null>(null);

  const openTemplateModal = (employee: EmployeeProfile) => {
    setSelectedEmployeeForTemplate(employee);
    setIsTemplateModalOpen(true);
  };

  // Pagination Logic
  const [itemsPerPage] = useState(20);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchEmployees = React.useCallback(async (reset = false) => {
    if (!reset && !hasMore) return;
    setLoading(true);

    try {
      const offset = reset ? 0 : employees.length;
      const page = Math.floor(offset / itemsPerPage) + 1;
      const result = await fetchWithCache(`/api/employees?limit=${itemsPerPage}&page=${page}`);
      
      const loadedEmployees = result.data || [];
      const total = result.pagination?.total || 0;

      if (loadedEmployees && loadedEmployees.length > 0) {
        setEmployees(prev => {
          if (reset) return loadedEmployees;
          // Deduplicate by ID to prevent "Encountered two children with the same key" error
          const merged = [...prev, ...loadedEmployees];
          const uniqueMap = new Map();
          merged.forEach(emp => {
            if (emp && emp.id) uniqueMap.set(emp.id, emp);
          });
          return Array.from(uniqueMap.values());
        });
        const currentCount = reset ? loadedEmployees.length : employees.length + loadedEmployees.length;
        setHasMore(currentCount < total);
      } else {
        if (reset) setEmployees([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employee directory. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, hasMore, employees.length, toast]);

  useEffect(() => {
    if (!permLoading && !canViewDirectory) {
      toast({ title: "Access Denied", description: "You do not have permission to view the employee directory.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    if (canViewDirectory) {
      fetchEmployees(true);
    }
  }, [permLoading, canViewDirectory, router, toast]);

  const hasIncompleteProfiles = useMemo(() =>
    employees.some(e => (e.completionPercentage || 0) < 100 && !e.isResigned),
    [employees]
  );

  const hasResignedEmployees = useMemo(() =>
    employees.some(e => e.isResigned),
    [employees]
  );

  const jobRoles = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const roles = list
      .map(e => e?.employmentDetails?.employeeRole)
      .filter(Boolean) as string[];
    return ['all', ...Array.from(new Set(roles))].sort();
  }, [employees]);

  const districts = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const dists = list
      .map(e => e?.addressDetails?.permanentAddress?.district)
      .filter(Boolean) as string[];
    // Use localeCompare for better sorting
    return ['all', ...Array.from(new Set(dists))].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const cities = useMemo(() => {
    let filtered = Array.isArray(employees) ? employees : [];
    if (selectedDistrict !== 'all') {
      filtered = filtered.filter(e => e?.addressDetails?.permanentAddress?.district === selectedDistrict);
    }
    const cityList = filtered
      .map(e => e?.addressDetails?.permanentAddress?.cityTownVillage)
      .filter(Boolean) as string[];
    // Use localeCompare for better sorting
    return ['all', ...Array.from(new Set(cityList))].sort((a, b) => a.localeCompare(b));
  }, [employees, selectedDistrict]);

  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return list.filter(employee => {
      if (!employee) return false;
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const nameMatch = (employee.personalDetails?.fullName || '').toLowerCase().includes(lowerCaseSearchTerm);
      const idMatch = (employee.employmentDetails?.employeeId || '').toLowerCase().includes(lowerCaseSearchTerm);
      const roleMatch = (employee.employmentDetails?.employeeRole || '').toLowerCase().includes(lowerCaseSearchTerm);
      const jobTitleMatch = (employee.employmentDetails?.jobTitle || '').toLowerCase().includes(lowerCaseSearchTerm);
      const departmentMatch = (employee.employmentDetails?.department || '').toLowerCase().includes(lowerCaseSearchTerm);
      // Added search by district and city
      const districtSearchMatch = (employee.addressDetails?.permanentAddress?.district || '').toLowerCase().includes(lowerCaseSearchTerm);
      const citySearchMatch = (employee.addressDetails?.permanentAddress?.cityTownVillage || '').toLowerCase().includes(lowerCaseSearchTerm);

      const searchMatch = nameMatch || idMatch || roleMatch || jobTitleMatch || departmentMatch || districtSearchMatch || citySearchMatch;
      if (!searchMatch) return false;

      const roleFilterMatch = selectedRole === 'all' || employee.employmentDetails?.employeeRole === selectedRole;
      if (!roleFilterMatch) return false;

      const districtMatch = selectedDistrict === 'all' || employee.addressDetails?.permanentAddress?.district === selectedDistrict;
      if (!districtMatch) return false;

      const cityMatch = selectedCity === 'all' || employee.addressDetails?.permanentAddress?.cityTownVillage === selectedCity;
      if (!cityMatch) return false;

      if (currentTab === 'incomplete') {
        return (employee.completionPercentage || 0) < 100 && !employee.isResigned;
      }
      if (currentTab === 'previous') {
        return employee.isResigned === true;
      }

      return !employee.isResigned;
    });
  }, [employees, searchTerm, currentTab, selectedRole, selectedDistrict, selectedCity]);

  const generatePdfHtml = (employee: EmployeeProfile) => {
    const { personalDetails, addressDetails, emergencyContact, medicalInfo, employmentDetails, bankDetails } = employee;
    const dob = personalDetails.dateOfBirth ? format(new Date(personalDetails.dateOfBirth), 'dd-MMM-yyyy') : 'N/A';
    const joiningDate = employmentDetails.joiningDate ? format(new Date(employmentDetails.joiningDate), 'dd-MMM-yyyy') : 'N/A';

    const fullPermanentAddress = [
      addressDetails.permanentAddress.buildingHouseNo, addressDetails.permanentAddress.buildingApartmentName,
      addressDetails.permanentAddress.streetArea, addressDetails.permanentAddress.cityTownVillage,
      addressDetails.permanentAddress.district, addressDetails.permanentAddress.stateProvince,
      addressDetails.permanentAddress.country, addressDetails.permanentAddress.pincode,
    ].filter(Boolean).join(', ');

    const currentAddressSource = addressDetails.isCurrentSameAsPermanent ? addressDetails.permanentAddress : addressDetails.currentAddress;
    const fullCurrentAddress = [
      currentAddressSource?.buildingHouseNo, currentAddressSource?.buildingApartmentName,
      currentAddressSource?.streetArea, currentAddressSource?.cityTownVillage,
      currentAddressSource?.district, currentAddressSource?.stateProvince,
      currentAddressSource?.country, currentAddressSource?.pincode,
    ].filter(Boolean).join(', ');

    const detailItemHtml = (icon: string, label: string, value: string | undefined | null) => `
        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 4px 0;">
            <div style="width: 20px; height: 20px; flex-shrink: 0; color: #555;">${icon}</div>
            <div style="font-size: 14px;">
                <p style="margin: 0; color: #555; font-size: 13px;">${label}</p>
                <p style="margin: 0; color: #111;">${value || 'N/A'}</p>
            </div>
        </div>
    `;

    return `
      <div id="pdf-content-${employmentDetails.employeeId}" style="font-family: Arial, sans-serif; padding: 40px; width: 794px; color: #333; background: #fff;">
        <header style="display: flex; align-items: center; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
          <img src="${personalDetails.photo}" alt="${personalDetails.fullName}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;" />
          <div>
            <h1 style="font-size: 28px; margin: 0; font-weight: 600;">${personalDetails.fullName}</h1>
            <p style="font-size: 18px; color: #2563eb; margin: 4px 0 0;">${employmentDetails.jobTitle || ''}</p>
            <p style="font-size: 14px; color: #666; margin: 4px 0 0;">Role: ${employmentDetails.employeeRole}</p>
            <p style="font-size: 14px; color: #666; margin: 4px 0 0;">Employee ID: ${employmentDetails.employeeId}</p>
          </div>
        </header>
        <div style="margin-top: 24px;">
          <div style="display: grid; grid-template-columns: 2fr 3fr; gap: 32px;">
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Personal Details</h3>
                ${detailItemHtml('&#128231;', 'Email', personalDetails.email)}
                ${detailItemHtml('&#128222;', 'Phone', `${personalDetails.phoneCountryCode} ${personalDetails.phoneNumber}`)}
                ${detailItemHtml('&#128197;', 'Date of Birth', dob)}
                ${detailItemHtml('&#128100;', 'Gender', personalDetails.gender)}
                ${detailItemHtml('&#10084;&#65039;', 'Marital Status', personalDetails.maritalStatus)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Address Details</h3>
                ${detailItemHtml('&#127968;', 'Aadhar Number', addressDetails.permanentAddress.aadharNumber)}
                ${detailItemHtml('&#127968;', 'Permanent Address', fullPermanentAddress)}
                ${detailItemHtml('&#127968;', 'Current Address', fullCurrentAddress)}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    ${detailItemHtml('&#128205;', 'Latitude', String(addressDetails.permanentAddress.latitude))}
                    ${detailItemHtml('&#128205;', 'Longitude', String(addressDetails.permanentAddress.longitude))}
                </div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <div>
            <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Emergency Contacts</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
                <div>
                    <p style="font-weight: 500; font-size: 15px; margin-bottom: 8px;">Primary</p>
                    ${detailItemHtml('&#128100;', 'Name', emergencyContact?.primaryContact?.name)}
                    ${detailItemHtml('&#128222;', 'Phone', emergencyContact?.primaryContact?.phoneNumber)}
                    ${detailItemHtml('&#129489;', 'Relation', emergencyContact?.primaryContact?.relation)}
                </div>
                <div>
                    <p style="font-weight: 500; font-size: 15px; margin-bottom: 8px;">Secondary</p>
                    ${detailItemHtml('&#128100;', 'Name', emergencyContact?.secondaryContact?.name)}
                    ${detailItemHtml('&#128222;', 'Phone', emergencyContact?.secondaryContact?.phoneNumber)}
                    ${detailItemHtml('&#129489;', 'Relation', emergencyContact?.secondaryContact?.relation)}
                </div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 32px;">
            <div>
                <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Employment Details</h3>
                ${detailItemHtml('&#128197;', 'Joining Date', joiningDate)}
            </div>
            <div>
                <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Medical Info</h3>
                ${detailItemHtml('&#128137;', 'Blood Group', medicalInfo?.bloodGroup)}
                <div style="margin-top: 8px;">
                    <p style="font-size: 13px; color: #555;">Health Issues</p>
                    <p style="font-size: 14px; margin: 2px 0 0;">${(medicalInfo?.healthIssues?.length || 0) > 0 ? medicalInfo.healthIssues.map((issue: any) => issue.name).join(', ') : 'N/A'}</p>
                </div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <div>
            <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Bank Account Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                ${detailItemHtml('&#128100;', 'Account Holder Name', bankDetails?.accountHolderName)}
                ${detailItemHtml('&#128179;', 'Account Number', bankDetails?.accountNumber)}
                ${detailItemHtml('&#127974;', 'IFSC Code', bankDetails?.ifscCode)}
                ${detailItemHtml('&#127974;', 'Bank Branch', bankDetails?.bankBranch)}
            </div>
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <h3 style="font-size: 18px; font-weight: 600; color: #2563eb; margin: 0 0 8px;">Declaration</h3>
            <p style="font-size: 14px; margin-bottom: 40px;">I hereby declare that the information provided above is true and correct to the best of my knowledge.</p>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="width: 200px; text-align: center;">
                <div style="margin: 0; padding-top: 20px; border-top: 1px solid #555;">(Employee Signature)</div>
              </div>
              <div style="width: 120px; text-align: center;">
                <div style="margin: 0; padding-top: 20px; border-top: 1px solid #555;">(Date)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const handleDownloadPdf = async (employee: EmployeeProfile) => {
    setLoadingPdf(employee.id);
    try {
      // Dynamic imports for heavy libraries
      const [jsPDF, html2canvas] = await Promise.all([
        import('jspdf').then(mod => mod.default),
        import('html2canvas').then(mod => mod.default)
      ]);

      const pdfContentId = `pdf-content-${employee.employmentDetails.employeeId}`;

      const contentDiv = document.createElement('div');
      contentDiv.style.position = 'absolute';
      contentDiv.style.left = '-9999px';
      contentDiv.style.width = '794px';
      contentDiv.innerHTML = generatePdfHtml(employee);
      document.body.appendChild(contentDiv);

      const elementToCapture = document.getElementById(pdfContentId);

      if (elementToCapture) {
        const canvas = await html2canvas(elementToCapture, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Profile-${employee.personalDetails.fullName.replace(/\s+/g, '_')}.pdf`);
      } else {
        throw new Error("PDF content element not found");
      }
      document.body.removeChild(contentDiv);
    } catch (error) {
      console.error("Error generating PDF: ", error);
      toast({
        title: "PDF Error",
        description: "Sorry, there was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingPdf(null);
    }
  };

  if (permLoading || (loading && employees.length === 0)) {
    return (
      <div className="p-6"><PageSkeleton /></div>
    );
  }

  if (!canViewDirectory) return null;

  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-3"
        icon={Users}
        badge="EMPLOYEE MANAGEMENT"
        title="Employee Directory"
        description="Find contact details and roles for all employees."
      >
        {canManageEmployees && (
        <Button asChild className="font-bold shadow-lg transition-all duration-300 hover:-translate-y-0.5 min-w-[150px]">
          <Link href="/dashboard/employee-directory/add">
            <UserPlus className="mr-2 h-4 w-4" /> Add New Employee
          </Link>
        </Button>
        )}
      </PageHero>
          <DashboardFilterBar>
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-10 bg-background"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-auto">
                <TabsList className="bg-background">
                  <TabsTrigger value="all">Active</TabsTrigger>
                  {hasIncompleteProfiles && (
                    <TabsTrigger value="incomplete">Incomplete</TabsTrigger>
                  )}
                  {hasResignedEmployees && (
                    <TabsTrigger value="previous">Previous</TabsTrigger>
                  )}
                </TabsList>
              </Tabs>

              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map(role => (
                    <SelectItem key={role} value={role}>
                      {role === 'all' ? 'All Roles' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDistrict} onValueChange={(val) => { setSelectedDistrict(val); setSelectedCity('all'); }}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map(dist => (
                    <SelectItem key={dist} value={dist}>
                      {dist === 'all' ? 'All Districts' : dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DashboardFilterBar>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className={cn(
                  "relative group overflow-hidden border-none shadow-sm hover:shadow-2xl transition-all duration-500 rounded-2xl flex flex-col h-full",
                  "bg-gradient-to-b from-white to-sky-50/30"
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-400 via-sky-500 to-sky-400" />

                <CardContent className="p-5 flex-grow space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-white shadow-lg group-hover:scale-105 transition-transform duration-500">
                        <AvatarImage src={employee?.personalDetails?.photo || 'https://placehold.co/100x100.png'} alt={employee?.personalDetails?.fullName || 'Employee'} />
                        <AvatarFallback className="bg-sky-50 text-sky-600 text-lg font-bold">
                          {(employee?.personalDetails?.fullName || 'EE').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="space-y-0.5">
                      <CardTitle className="text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors duration-300">
                        {employee?.personalDetails?.fullName || 'Unnamed Employee'}
                      </CardTitle>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={employee?.employmentDetails?.employeeRole ? "secondary" : "outline"} className={cn(
                          "w-fit py-0.5 px-2.5 text-[11px] font-bold uppercase tracking-wider",
                          employee?.employmentDetails?.employeeRole ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {employee?.employmentDetails?.employeeRole || 'No Role Set'}
                        </Badge>
                        <p className="text-[11px] font-bold text-slate-500">
                          {employee?.employmentDetails?.employeeId ? `ID: ${employee.employmentDetails.employeeId}` : 'ID: Not Assigned'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center gap-3 group/item">
                      <div className="p-2 rounded-lg bg-sky-50/50 group-hover/item:bg-sky-100 group-hover/item:text-sky-600 transition-colors duration-300">
                        <Mail className="h-3.5 w-3.5" />
                      </div>
                      <a href={`mailto:${employee?.personalDetails?.email || ''}`} className="text-sm font-semibold text-slate-600 hover:text-sky-600 hover:underline transition-colors truncate" title={employee?.personalDetails?.email || ''}>
                        {employee?.personalDetails?.email || 'N/A'}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 group/item">
                      <div className="p-2 rounded-lg bg-sky-50/50 group-hover/item:bg-sky-100 group-hover/item:text-sky-600 transition-colors duration-300">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-600">
                        {employee?.personalDetails?.phoneCountryCode || '+91'} {employee?.personalDetails?.phoneNumber || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 group/item">
                      <div className="p-2 rounded-lg bg-sky-50/50 group-hover/item:bg-sky-100 group-hover/item:text-sky-600 transition-colors duration-300">
                        <Building className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 truncate">
                        {employee?.addressDetails?.permanentAddress?.cityTownVillage || 'N/A'}, {employee?.addressDetails?.permanentAddress?.country || 'India'}
                      </span>
                    </div>
                  </div>

                  {(employee.completionPercentage || 0) < 100 && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        <span>Profile Completion</span>
                        <span className={cn((employee.completionPercentage || 0) < 50 ? "text-destructive" : "text-amber-500")}>
                          {(employee.completionPercentage || 0)}%
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-1000", (employee.completionPercentage || 0) < 50 ? "bg-destructive" : "bg-amber-500")} style={{ width: `${employee.completionPercentage || 0}%` }} />
                      </div>
                    </div>
                  )}
                </CardContent>

                <div className="p-3 bg-gradient-to-tr from-sky-50/50 to-white/50 border-t border-sky-100/50 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 shadow-sm bg-white border-sky-100/80 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 text-slate-700 font-bold text-sm h-10 transition-all duration-300 rounded-xl">
                    <Link href={`/dashboard/employee-directory/${employee.id}`} className="flex items-center justify-center">
                      <Eye className="mr-2 h-3.5 w-3.5 text-sky-600" /> View Profile
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shadow-sm bg-white border-sky-100/80 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 shrink-0 transition-all duration-300 rounded-xl"
                    onClick={() => openTemplateModal(employee)}
                  >
                    <TemplateIcon className="h-3.5 w-3.5 text-blue-600" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shadow-sm bg-white border-sky-100/80 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 shrink-0 transition-all duration-300 rounded-xl"
                    onClick={() => handleDownloadPdf(employee)}
                    disabled={loadingPdf === employee.id}
                  >
                    {loadingPdf === employee.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-sky-600" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <UseTemplateModal
            isOpen={isTemplateModalOpen}
            onClose={() => setIsTemplateModalOpen(false)}
            entityData={selectedEmployeeForTemplate}
            entityType="employee"
          />

          {hasMore && (
            <div className="flex justify-center mt-10">
              <Button
                onClick={() => fetchEmployees(false)}
                disabled={loading}
                variant="outline"
                className="rounded-xl px-8 h-11 font-bold text-sky-600 border-sky-200 hover:bg-sky-50 hover:border-sky-300"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load More Employees
              </Button>
            </div>
          )}

          {filteredEmployees.length === 0 && !loading && (
            <div className="text-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200/60 mt-6">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No employees found matching your criteria.</p>
              <Button variant="link" className="text-sky-600 font-bold" onClick={() => { setSearchTerm(''); setSelectedRole('all'); setSelectedDistrict('all'); setSelectedCity('all'); setCurrentTab('all'); }}>Clear all filters</Button>
            </div>
          )}
    </div>
  );
}
