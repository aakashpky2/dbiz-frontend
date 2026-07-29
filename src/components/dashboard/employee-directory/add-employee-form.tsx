import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Home, PhoneCall, HeartPulse, Briefcase, Percent, Landmark, CheckCircle2, GraduationCap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { calculateEmployeeProfileCompletion } from '@/lib/employee-completion';

import { PersonalDetailsForm, personalDetailsSchema } from './form-sections/personal-details-form';
import { AddressDetailsForm, addressDetailsSchema } from './form-sections/address-details-form';
import { EmergencyContactForm, emergencyContactSchema } from './form-sections/emergency-contact-form';
import { MedicalInfoForm, medicalInfoSchema } from './form-sections/medical-info-form';
import { QualificationDetailsForm, qualificationDetailsSchema } from './form-sections/qualification-details-form';
import { BankDetailsForm, bankDetailsSchema } from './form-sections/bank-details-form';
import { EmploymentDetailsForm, employmentDetailsSchema } from './form-sections/employment-details-form';

import { format } from 'date-fns';
import { parsePhoneFromPayload, formatPhoneForPayload } from '@/lib/phone-utils';

const addEmployeeFormSchema = z.object({
  personalDetails: personalDetailsSchema,
  addressDetails: addressDetailsSchema,
  emergencyContact: emergencyContactSchema,
  medicalInfo: medicalInfoSchema,
  qualificationDetails: z.array(qualificationDetailsSchema),
  bankDetails: bankDetailsSchema,
  employmentDetails: employmentDetailsSchema,
  correctError: z.boolean().optional(),
});

export type AddEmployeeFormValues = z.infer<typeof addEmployeeFormSchema>;

const TABS = [
  { value: 'personal', label: 'Personal', icon: UserCircle, schemaKey: 'personalDetails' },
  { value: 'address', label: 'Address', icon: Home, schemaKey: 'addressDetails' },
  { value: 'emergency', label: 'Emergency', icon: PhoneCall, schemaKey: 'emergencyContact' },
  { value: 'medical', label: 'Medical', icon: HeartPulse, schemaKey: 'medicalInfo' },
  { value: 'education', label: 'Education', icon: GraduationCap, schemaKey: 'qualificationDetails' },
  { value: 'bank', label: 'Bank', icon: Landmark, schemaKey: 'bankDetails' },
];

const EMPTY_VALUES: AddEmployeeFormValues = {
  personalDetails: {
    fullName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+91',
    photo: null,
    dateOfBirth: undefined,
    gender: undefined,
    maritalStatus: undefined,
    joiningDate: undefined as any,
  },
  addressDetails: {
    permanentAddress: {
      aadharNumber: '',
      buildingHouseNo: '',
      buildingApartmentName: '',
      streetArea: '',
      cityTownVillage: '',
      country: 'India',
      stateProvince: '',
      district: '',
      pincode: '',
      latitude: 8.504391287203669,
      longitude: 76.96805215217263,
    },
    isCurrentSameAsPermanent: false,
    currentAddress: {
      buildingHouseNo: '',
      buildingApartmentName: '',
      streetArea: '',
      cityTownVillage: '',
      country: 'India',
      stateProvince: '',
      district: '',
      pincode: '',
      latitude: 8.504391287203669,
      longitude: 76.96805215217263,
    }
  },
  emergencyContact: {
    primaryContact: { name: '', relation: '', phoneNumber: '', countryCode: '+91' },
    secondaryContact: { name: '', relation: '', phoneNumber: '', countryCode: '+91' },
  },
  medicalInfo: {
    bloodGroup: undefined,
    healthIssues: [],
  },
  qualificationDetails: [{
    highestQualification: '',
    institutionName: '',
    specialization: '',
  }],
  bankDetails: {
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankBranch: '',
  },
  employmentDetails: {
    employeeId: '',
    employeeRole: '',
    jobTitle: '',
    employmentTermYears: 0,
    employmentTermMonths: 0,
    monthlySalary: 0,
    casualLeavesPerMonth: 1,
    sickLeavesPerMonth: 1,
    startTime: '09:30',
    endTime: '17:30',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    relievingDate: undefined,
  }
};

const CompletionMeter = () => {
  const allData = useFormContext().watch();

  const completionPercentage = useMemo(() => {
    return calculateEmployeeProfileCompletion(allData);
  }, [allData]);

  if (completionPercentage === 100) return null;

  return (
    <div className="mb-6 p-4 border rounded-lg bg-muted/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground flex items-center">
          <Percent className="h-4 w-4 mr-2 text-primary" />
          Profile Completion
        </h3>
        <span className="text-lg font-bold text-primary">{completionPercentage}%</span>
      </div>
      <Progress value={completionPercentage} className="w-full h-4 rounded-full" animated />
    </div>
  );
};

interface AddEmployeeFormProps {
  onPhotoChange: (previewUrl: string | null) => void;
  onNameChange: (name: string) => void;
  existingEmployee?: any; // To pass employee data for editing
}

export function AddEmployeeForm({ onPhotoChange, onNameChange, existingEmployee }: AddEmployeeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(TABS[0].value);
  const { toast } = useToast();
  const router = useRouter();

  const methods = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeFormSchema),
    defaultValues: EMPTY_VALUES,
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const { handleSubmit, trigger, formState: { errors, isValid, isDirty }, watch, reset, setValue } = methods;


  // DATA NORMALIZATION LAYER
  const normalizeEmployeeData = useMemo(() => (data: any): AddEmployeeFormValues => {
    if (!data) return EMPTY_VALUES;
    
    const personal = data.personalDetails || {};
    const address = data.addressDetails || {};
    const emergency = data.emergencyContact || {};
    const medical = data.medicalInfo || {};
    const qualifications = data.qualificationDetails || data.employee_qualifications || [];
    const bank = data.bankDetails || {};
    return {
      personalDetails: {
        ...EMPTY_VALUES.personalDetails,
        ...personal,
        fullName: personal.fullName || data.full_name || '',
        email: personal.email || data.email || '',
        phone: personal.phoneNumber || data.phone_number || '',
        phoneCountryCode: personal.phoneCountryCode || data.phone_country_code || '+91',
        photo: personal.photo || data.photo_url || null,
        dateOfBirth: personal.dateOfBirth ? new Date(personal.dateOfBirth) : (data.date_of_birth ? new Date(data.date_of_birth) : undefined),
        joiningDate: personal.joiningDate ? new Date(personal.joiningDate) : (data.joining_date ? new Date(data.joining_date) : undefined),
      },
      addressDetails: {
        isCurrentSameAsPermanent: !!address.isCurrentSameAsPermanent,
        permanentAddress: { ...EMPTY_VALUES.addressDetails.permanentAddress, ...(address.permanentAddress || {}) },
        currentAddress: { ...EMPTY_VALUES.addressDetails.currentAddress, ...(address.currentAddress || {}) }
      },
      emergencyContact: {
        primaryContact: { 
          ...EMPTY_VALUES.emergencyContact.primaryContact, 
          ...(emergency.primaryContact || {}),
          phoneNumber: (emergency.primaryContact?.phoneNumber || emergency.primary_phone || ''),
          countryCode: (emergency.primaryContact?.countryCode || '+91')
        },
        secondaryContact: { 
          ...EMPTY_VALUES.emergencyContact.secondaryContact, 
          ...(emergency.secondaryContact || {}),
          phoneNumber: (emergency.secondaryContact?.phoneNumber || emergency.secondary_phone || ''),
          countryCode: (emergency.secondaryContact?.countryCode || '+91')
        },
      },
      medicalInfo: {
        bloodGroup: medical.bloodGroup || data.blood_group || undefined,
        healthIssues: medical.healthIssues || data.health_issues || [],
      },
      qualificationDetails: Array.isArray(qualifications) && qualifications.length > 0
        ? qualifications.map((q: any) => ({
            highestQualification: q.highestQualification || q.highest_qualification || q.qualification_name || '',
            institutionName: q.institutionName || q.institution_name || q.institution || '',
            specialization: q.specialization || ''
          }))
        : EMPTY_VALUES.qualificationDetails,
      bankDetails: {
        accountHolderName: bank.accountHolderName || '',
        accountNumber: bank.accountNumber || '',
        ifscCode: bank.ifscCode || '',
        bankBranch: bank.bankBranch || '',
      },
      employmentDetails: {
        employeeId: data.employee_id_hash || data.employmentDetails?.employeeId || '',
        employeeRole: data.employee_role || data.employmentDetails?.employeeRole || '',
        jobTitle: data.job_title || data.employmentDetails?.jobTitle || '',
        employmentTermYears: data.employment_term_years || data.employmentDetails?.employmentTermYears || 0,
        employmentTermMonths: data.employment_term_months || data.employmentDetails?.employmentTermMonths || 0,
        monthlySalary: data.monthly_salary || data.employmentDetails?.monthlySalary || 0,
        casualLeavesPerMonth: data.casual_leaves_per_month || data.employmentDetails?.casualLeavesPerMonth || 1,
        sickLeavesPerMonth: data.sick_leaves_per_month || data.employmentDetails?.sickLeavesPerMonth || 1,
        startTime: data.start_time || data.employmentDetails?.startTime || '09:30',
        endTime: data.end_time || data.employmentDetails?.endTime || '17:30',
        workingDays: data.working_days || data.employmentDetails?.workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        relievingDate: data.relieving_date ? new Date(data.relieving_date) : (data.employmentDetails?.relievingDate ? new Date(data.employmentDetails.relievingDate) : undefined),
      },
      correctError: false
    };
  }, []);

  // IMPLEMENT FORM RESET FOR EDIT MODE
  useEffect(() => {
    if (existingEmployee) {
      const normalizedData = normalizeEmployeeData(existingEmployee);
      reset(normalizedData);
      
      if (normalizedData.personalDetails.fullName) {
        onNameChange(normalizedData.personalDetails.fullName);
      }
      if (normalizedData.personalDetails.photo) {
        onPhotoChange(normalizedData.personalDetails.photo);
      }
    }
  }, [existingEmployee, reset, normalizeEmployeeData, onNameChange, onPhotoChange]);

  // Watch form state for reactive helpers
  const currentFormData = watch();

  // Button Readiness Helper
  const isFormReady = useMemo(() => {
    return (
      !!currentFormData.personalDetails?.fullName?.trim() &&
      !!currentFormData.personalDetails?.email?.trim()
    );
  }, [currentFormData]);

  // Track tab validity for visual indicators
  const tabValidity = useMemo(() => {
    return {
      personal: !!currentFormData.personalDetails?.fullName && !!currentFormData.personalDetails?.email && !errors.personalDetails,
      address: !!currentFormData.addressDetails?.permanentAddress?.cityTownVillage && !errors.addressDetails,
      emergency: !!currentFormData.emergencyContact?.primaryContact?.name && !errors.emergencyContact,
      medical: !!currentFormData.medicalInfo?.bloodGroup && !errors.medicalInfo,
      education: Array.isArray(currentFormData.qualificationDetails) && currentFormData.qualificationDetails.length > 0 && !!currentFormData.qualificationDetails[0].highestQualification && !errors.qualificationDetails,
      employment: !!currentFormData.employmentDetails?.employeeRole && !!currentFormData.employmentDetails?.jobTitle && !errors.employmentDetails,
      bank: !!currentFormData.bankDetails?.accountNumber && !errors.bankDetails,
    };
  }, [currentFormData, errors]);

  const onSubmit = async (validatedData: AddEmployeeFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    const completionPercentage = calculateEmployeeProfileCompletion(validatedData);

    try {
      const endpoint = '/api/employees';
      const method = existingEmployee ? 'PUT' : 'POST';
      const finalUrl = existingEmployee ? `${endpoint}/${existingEmployee.id}` : endpoint;

      // Split phone numbers before submission
      const personalPhone = { 
        number: validatedData.personalDetails.phone, 
        countryCode: validatedData.personalDetails.phoneCountryCode || '+91' 
      };
      const primaryEmergency = { 
        number: validatedData.emergencyContact.primaryContact.phoneNumber, 
        countryCode: validatedData.emergencyContact.primaryContact.countryCode || '+91' 
      };
      const secondaryEmergency = { 
        number: validatedData.emergencyContact.secondaryContact?.phoneNumber || '', 
        countryCode: validatedData.emergencyContact.secondaryContact?.countryCode || '+91' 
      };

      const payload = {
        ...validatedData,
        completionPercentage,
        personalDetails: {
          ...validatedData.personalDetails,
          phoneNumber: personalPhone.number,
          phoneCountryCode: personalPhone.countryCode
        },
        emergencyContact: {
          ...validatedData.emergencyContact,
          primaryContact: {
            ...validatedData.emergencyContact.primaryContact,
            phoneNumber: primaryEmergency.number,
            phoneCountryCode: primaryEmergency.countryCode
          },
          secondaryContact: validatedData.emergencyContact.secondaryContact ? {
            ...validatedData.emergencyContact.secondaryContact,
            phoneNumber: secondaryEmergency.number,
            phoneCountryCode: secondaryEmergency.countryCode
          } : undefined
        }
      };

      const response = await fetch(finalUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save employee');
      }

      // Invalidate the cache for the employee directory
      const { clearCache } = await import('@/lib/fetcher');
      clearCache(); // Clear all to be safe, or just specific URLs

      toast({
        title: existingEmployee ? 'Employee Updated' : 'Employee Created',
        description: `${validatedData.personalDetails.fullName} has been saved successfully.`,
      });

      router.push('/dashboard/employee-directory');
    } catch (error: any) {
      toast({
        title: 'Operation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextTab = async () => {
    const currentTabIndex = TABS.findIndex(tab => tab.value === currentTab);
    const currentSchemaKey = TABS[currentTabIndex].schemaKey as keyof AddEmployeeFormValues;

    const isValid = await trigger(currentSchemaKey, { shouldFocus: true });

    if (isValid) {
      if (currentTabIndex < TABS.length - 1) {
        setCurrentTab(TABS[currentTabIndex + 1].value);
      }
    } else {
      const fieldErrors = errors[currentSchemaKey];
      const firstError = fieldErrors ? Object.values(fieldErrors)[0] as any : null;
      
      toast({
        title: "Validation Error",
        description: firstError?.message || "Please correct the errors in this section before proceeding.",
        variant: "destructive",
      });
    }
  };

  const handlePreviousTab = () => {
    const currentTabIndex = TABS.findIndex(tab => tab.value === currentTab);
    if (currentTabIndex > 0) {
      setCurrentTab(TABS[currentTabIndex - 1].value);
    }
  };

  return (
    <FormProvider {...methods}>
      <CompletionMeter />
      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto w-full bg-slate-50/80 p-1 mb-8 rounded-xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
            {TABS.map((tab) => {
              const isValid = tabValidity[tab.value as keyof typeof tabValidity];
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "flex-1 min-w-[100px] py-2 px-3 rounded-lg transition-all duration-300 relative overflow-hidden group text-slate-500",
                    "data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary",
                    "hover:text-slate-800",
                    isValid && "text-green-600 data-[state=active]:text-green-700"
                  )}
                >
                  <div className="flex flex-col items-center gap-1 z-10">
                    <div className={cn(
                       "p-1.5 rounded-full transition-colors group-hover:bg-primary/5",
                       isValid ? "bg-green-100 text-green-600" : "bg-white text-slate-400 group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary shadow-sm border border-slate-100"
                    )}>
                      {isValid ? <CheckCircle2 className="h-4 w-4" /> : <tab.icon className="h-4 w-4" />}
                    </div>
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-tight">{tab.label}</span>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-primary rounded-full scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-500 origin-center" />
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-4 min-h-[400px]">
            <TabsContent value="personal" className="focus-visible:outline-none">
              <PersonalDetailsForm 
                onPhotoChange={onPhotoChange} 
                existingPhoto={watch('personalDetails.photo')} 
                onNameChange={onNameChange} 
              />
            </TabsContent>
            <TabsContent value="address" className="focus-visible:outline-none">
              <AddressDetailsForm />
            </TabsContent>
            <TabsContent value="emergency" className="focus-visible:outline-none">
              <EmergencyContactForm />
            </TabsContent>
            <TabsContent value="medical" className="focus-visible:outline-none">
              <MedicalInfoForm />
            </TabsContent>
            <TabsContent value="education" className="focus-visible:outline-none">
              <QualificationDetailsForm />
            </TabsContent>
            <TabsContent value="bank" className="focus-visible:outline-none">
              <BankDetailsForm />
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviousTab}
            disabled={isLoading || currentTab === TABS[0].value}
            className="min-w-[120px] rounded-xl hover:bg-slate-50"
          >
            Previous
          </Button>

          {currentTab !== TABS[TABS.length - 1].value && (
            <Button
              type="button"
              onClick={handleNextTab}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px] rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              Next
            </Button>
          )}

          {currentTab === TABS[TABS.length - 1].value && (
            <Button
              type="submit"
              disabled={isLoading || !isFormReady}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[180px] rounded-xl shadow-xl shadow-primary/25 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                existingEmployee ? 'Update Profile' : 'Register Employee'
              )}
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
