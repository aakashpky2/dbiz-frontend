import { z } from 'zod';
import { phoneValidation, PHONE_ERROR_MESSAGE } from '@/lib/phone-utils';

export const NAME_REGEX = /^[A-Za-z\s.'\-&/]+$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

// Data Structures
export interface BillingRule {
  description: string;
  applicationCondition: string;
  invoiceSource: 'Us' | 'Associate';
  companyBillingType?: 'Us to Customer' | 'Us to Associate' | 'Partially to Customer and Associate';
  effectiveDate: string;
  isSelected: boolean;
}

export interface CommissionRule {
  description: string;
  commissionType: 'Percentage' | 'Fixed';
  value: number;
  applicationCondition: string;
  effectiveDate: string;
  isSelected: boolean;
}

export interface Associate {
  id: string; // Database UUID
  companyName?: string;
  name: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  billingRules: BillingRule[];
  commissionRules: CommissionRule[];
  profiles: string[];
  profileNames?: string[];
  parentId?: string;
  parentName?: string;
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  hasRepresentatives?: boolean;
  contactPersons?: {
    name: string;
    phone: string;
    email: string;
    designation: string;
    contactReason: string;
    date?: string;
    isSameAsAssociate?: boolean
  }[];
  gstNumber?: string;
  gstEffectiveDate?: string;
  panNumber?: string;
  streetAddress?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  address?: string;
  documents?: { type: string; customType?: string; fileUrl: string; fileName?: string }[];
  statusEffectiveDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Zod Schemas
export const billingRuleSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  applicationCondition: z.string().min(1, 'Condition is required.'),
  invoiceSource: z.enum(['Us', 'Associate'], { required_error: 'Invoice source is required.' }),
  companyBillingType: z.enum(['Us to Customer', 'Us to Associate', 'Partially to Customer and Associate']).optional(),
  effectiveDate: z.string().min(1, 'Effective date is required.'),
  isSelected: z.boolean().default(true),
}).refine(data => {
  if (data.invoiceSource === 'Us' && !data.companyBillingType) {
    return false;
  }
  return true;
}, {
  message: "Flow type is required when invoice source is 'Us'.",
  path: ["companyBillingType"],
});

export const commissionRuleSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  commissionType: z.enum(['Percentage', 'Fixed'], { required_error: 'Type is required.' }),
  value: z.coerce.number().min(0, 'Value must be positive.'),
  applicationCondition: z.string().min(1, 'Condition is required.'),
  effectiveDate: z.string().min(1, 'Effective date is required.'),
  isSelected: z.boolean().default(true),
});

export const documentSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  customType: z.string().optional(),
  fileUrl: z.string().min(1, 'File is required'),
  fileName: z.string().optional()
});

export const associateFormSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(100, 'Company name cannot exceed 100 characters'),
  name: z.string().trim()
    .min(3, 'Name must be between 3–50 characters')
    .max(50, 'Name must be between 3–50 characters')
    .regex(/^[A-Za-z ]+$/, 'Name must contain only letters'),
  phone: z.string().trim()
    .min(1, "Phone number is required.")
    .refine(val => phoneValidation(val), { message: PHONE_ERROR_MESSAGE })
    .optional().or(z.literal('')),
  email: z.string().trim()
    .email('Enter a valid email address')
    .max(100, 'Email cannot exceed 100 characters')
    .optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  hasParentAssociate: z.boolean().default(false),
  parentId: z.string().optional().nullable(),
  profiles: z.array(z.string()).min(0).default([]),
  contactPersonName: z.string().trim()
    .min(3, 'Name must be between 3–50 characters')
    .max(50, 'Name must be between 3–50 characters')
    .regex(/^[A-Za-z ]+$/, 'Name must contain only letters')
    .optional().or(z.literal('')),
  contactPersonPhone: z.string().trim()
    .refine(val => !val || phoneValidation(val), { message: PHONE_ERROR_MESSAGE })
    .optional().or(z.literal('')),
  contactPersonEmail: z.string().trim()
    .email('Enter a valid email address')
    .max(100, 'Email cannot exceed 100 characters')
    .optional().or(z.literal('')),
  contactPersons: z.array(z.object({
    name: z.string().trim().min(3, 'Min 3 chars').max(50, 'Max 50 chars').regex(NAME_REGEX, 'Letters and common symbols only (., -, &, /)'),
    phone: z.string().trim()
      .refine(val => !val || phoneValidation(val), { message: PHONE_ERROR_MESSAGE })
      .optional().or(z.literal('')),
    email: z.string().trim().email('Invalid email').max(100, 'Max 100 chars').optional().or(z.literal('')),
    designation: z.string().trim().max(100, 'Max 100 chars').optional().or(z.literal('')),
    contactReason: z.string().trim().max(200, 'Max 200 chars').optional().or(z.literal('')),
    date: z.string().optional().or(z.literal('')),
    isSameAsAssociate: z.boolean().optional().default(false),
  }).refine(data => !!data.phone?.trim() || !!data.email?.trim(), {
    message: "Either Phone or Email is mandatory for each contact person",
    path: ["phone"]
  })).min(1, 'At least one contact person is required.').default([{ name: '', phone: '', email: '', designation: '', contactReason: '', date: '', isSameAsAssociate: false }]),
  gstNumber: z.string().trim()
    .superRefine((val, ctx) => {
      if (val.length > 0 && val.length < 15) {
        // Silent
      } else if (val.length >= 15) {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid GST number' });
        }
      }
    })
    .optional().or(z.literal('')),
  gstEffectiveDate: z.string().optional(),
  panNumber: z.string().trim()
    .superRefine((val, ctx) => {
      if (val.length > 0 && val.length < 10) {
        // Silent
      } else if (val.length >= 10) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid PAN (e.g., ABCDE1234F)' });
        }
      }
    })
    .optional().or(z.literal('')),
  streetAddress: z.string().trim().max(200, 'Address cannot exceed 200 characters').optional().or(z.literal('')),
  locality: z.string().trim().max(200, 'Address cannot exceed 200 characters').optional().or(z.literal('')),
  city: z.string().trim().max(100, 'City/Town/Village cannot exceed 100 characters').optional().or(z.literal('')),
  district: z.string().trim().max(50, 'District cannot exceed 50 characters').regex(/^[A-Za-z ]*$/, 'Only letters allowed').optional().or(z.literal('')),
  state: z.string().trim().max(50, 'State cannot exceed 50 characters').regex(/^[A-Za-z ]*$/, 'Only letters allowed').optional().or(z.literal('')),
  country: z.string().trim().max(50, 'Country cannot exceed 50 characters').default('India').optional().or(z.literal('')),
  pincode: z.string().trim()
    .superRefine((val, ctx) => {
      if (val.length > 0 && val.length < 6) {
        // Silent
      } else if (val.length >= 6) {
        if (!/^[1-9][0-9]{5}$/.test(val)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid 6-digit pincode' });
        }
      }
    })
    .optional().or(z.literal('')),
  hasGST: z.boolean().default(false),
  hasPAN: z.boolean().default(false),
  hasAddress: z.boolean().default(false),
  hasDocuments: z.boolean().default(false),
  documents: z.array(documentSchema).optional().default([]),
  address: z.string().optional(),
  billingRules: z.array(billingRuleSchema).optional().default([]),
  commissionRules: z.array(commissionRuleSchema).optional().default([]),
  statusEffectiveDate: z.string().optional(),
}).refine(data => {
  if (data.status === 'Inactive' && !data.statusEffectiveDate) {
    return false;
  }
  return true;
}, {
  message: "Effective date is required when making an associate inactive.",
  path: ["statusEffectiveDate"],
}).refine(data => {
  if (data.hasGST) return !!data.gstNumber;
  return true;
}, {
  message: "GST Number is required when enabled",
  path: ["gstNumber"]
}).refine(data => {
  if (data.hasPAN) return !!data.panNumber;
  return true;
}, {
  message: "PAN Number is required when enabled",
  path: ["panNumber"]
}).refine(data => {
  if (data.hasAddress) return !!data.streetAddress && !!data.district && !!data.state && !!data.pincode;
  return true;
}, {
  message: "Address details are required when enabled",
  path: ["streetAddress"]
}).refine(data => {
  if (data.hasParentAssociate) return !!data.parentId && data.parentId !== 'none';
  return true;
}, {
  message: "Parent associate is required when toggle is on",
  path: ["parentId"]
}).refine(data => !!data.phone?.trim() || !!data.email?.trim(), {
  message: "Provide either Phone or Email",
  path: ["phone"]
}).refine(data => {
  const contacts = data.contactPersons;
  if (!contacts || contacts.length <= 1) return true;
  const seenNamePhone = new Set();
  const seenNameEmail = new Set();
  for (const c of contacts) {
    const nameStr = (c.name || '').trim().toLowerCase();
    const phoneStr = (c.phone || '').trim();
    const emailStr = (c.email || '').trim().toLowerCase();
    
    if (nameStr && phoneStr) {
      const npKey = `${nameStr}-${phoneStr}`;
      if (seenNamePhone.has(npKey)) return false;
      seenNamePhone.add(npKey);
    }
    
    if (nameStr && emailStr) {
      const neKey = `${nameStr}-${emailStr}`;
      if (seenNameEmail.has(neKey)) return false;
      seenNameEmail.add(neKey);
    }
  }
  return true;
}, {
  message: "DUPLICATE_CONTACTS",
  path: ["contactPersons"]
});

export type AssociateFormValues = z.infer<typeof associateFormSchema>;

export interface BusinessProfile {
  id: string;
  profile_name: string;
  is_default?: boolean;
}

