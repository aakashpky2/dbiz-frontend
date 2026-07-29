import * as z from 'zod';
import { z as zod } from 'zod';

// Data Structures
export interface FieldDefinitionData {
  fieldName: string;
  fieldKey: string;
  fieldType: 'Text' | 'Number' | 'Email' | 'Phone' | 'PAN' | 'GSTIN' | 'File Upload';
  inputType: 'TextInput' | 'Textarea' | 'Dropdown' | 'Checkbox' | 'Radio' | 'FileUpload';
  requirement: 'Mandatory' | 'Optional' | 'If Available';
  availableQuestion?: string;
  maxLength?: number;
  options?: string[];
  countryCode?: string;
  isMultipleUpload?: boolean;
  isCountryCodeEnabled?: boolean;
}

export interface SectionData {
  sectionName: string;
  sectionKey: string;
  fields: FieldDefinitionData[];
}

export interface RoleData {
  roleKey: string;
  roleName: string;
  isManagementRole: boolean;
  minMembers: number;
  maxMembers: number;
  hierarchyLevel?: number;
  designations: string[];
  requiredDetails: SectionData[];
}

export interface BusinessTypeSetup {
  id: string;
  businessType: string;
  businessSubType: string;
  type_subtype_key?: string;
  display_order: number;
  sub_display_order: number;
  required_fields: SectionData[];
  roles: RoleData[];
}

export const slugify = (text: string | null | undefined): string => {
  if (typeof text !== 'string') return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '_')
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
};

export const FIELD_TYPES = ['Text', 'Number', 'Email', 'Phone', 'PAN', 'GSTIN', 'File Upload'] as const;
export const INPUT_TYPES = [
  { value: 'TextInput', label: 'Text Input' },
  { value: 'Textarea', label: 'Textarea' },
  { value: 'Dropdown', label: 'Dropdown' },
  { value: 'Checkbox', label: 'Checkbox' },
  { value: 'Radio', label: 'Radio' },
  { value: 'FileUpload', label: 'File Upload' },
] as const;

export const fieldDefinitionSchema = z.object({
  fieldName: z.string().min(1, "Field Name is required.").max(100, "Too long.").nullable().optional().default(''),
  fieldKey: z.string().optional(),
  fieldType: z.enum(FIELD_TYPES, { required_error: 'Field type is required.' }).default('Text'),
  inputType: z.enum(['TextInput', 'Textarea', 'Dropdown', 'Checkbox', 'Radio', 'FileUpload']).default('TextInput'),
  requirement: z.enum(['Mandatory', 'Optional', 'If Available'], { required_error: "Requirement level is required." }).default('Optional'),
  availableQuestion: z.string().optional().default(''),
  maxLength: z.coerce.number().int().min(0, "Max length must be a non-negative number.").optional().default(0),
  options: z.array(z.string()).optional().default([]),
  countryCode: z.string().nullable().optional().default('+91'),
  isMultipleUpload: z.boolean().nullable().optional().default(false),
  isCountryCodeEnabled: z.boolean().nullable().optional().default(false),
});

export const sectionSchema = z.object({
  sectionName: z.string().min(1, "Section Name is required.").nullable().optional().default(''),
  sectionKey: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).default([])
});

export const roleFormSchema = z.object({
  roleName: z.string().min(1, "Role Name is required.").max(100, "Too long.").nullable().optional().default(''),
  isManagementRole: z.boolean().optional().default(false),
  minMembers: z.coerce.number().min(0, "Min members must be non-negative.").default(0),
  maxMembers: z.union([
    z.coerce.number().min(0),
    z.literal(-1) // represents unlimited
  ]).default(0),
  hierarchyLevel: z.coerce.number().min(1, "Level must be 1 or higher.").default(1),
  designations: z.array(z.string()).default([]),
  requiredDetails: z.array(sectionSchema).optional().default([]),
}).refine(data => {
  if (data.minMembers === 0) return data.maxMembers === 0 || data.maxMembers === -1;
  if (data.maxMembers === -1) return true;
  return data.maxMembers >= data.minMembers;
}, {
  message: "Max members must be greater than or equal to Min members.",
  path: ["maxMembers"],
});

export const businessTypeFormSchema = z.object({
  businessType: z.string().min(3, "Business type must be at least 3 characters.").max(100),
  businessSubType: z.string().min(3, "Business sub-type must be at least 3 characters.").max(100),
  display_order: z.coerce.number().min(0, "Order must be 0 or higher.").default(0),
  sub_display_order: z.coerce.number().min(0, "Order must be 0 or higher.").default(0),
  requiredSections: z.array(sectionSchema).optional().default([]),
  roles: z.array(roleFormSchema).optional().default([]),
}).superRefine((data, ctx) => {
  // Check for at least one management role only if roles exist
  if (data.roles && data.roles.length > 0) {
    const hasManagementRole = data.roles.some(role => role.isManagementRole);
    if (!hasManagementRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one role must be designated as a Management Role for signing/approval authority.",
        path: ["roles"],
      });
    }
  }
});

export type FieldDefinitionValues = z.infer<typeof fieldDefinitionSchema>;
export type RoleFormValues = z.infer<typeof roleFormSchema>;
export type BusinessTypeFormValues = z.infer<typeof businessTypeFormSchema>;