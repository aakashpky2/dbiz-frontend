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
  fieldName: z.string().trim().min(1, "Field Name is required.").max(100, "Too long.").nullable().optional().default(''),
  fieldKey: z.string().optional(),
  fieldType: z.enum(FIELD_TYPES, { required_error: 'Field type is required.' }).default('Text'),
  inputType: z.enum(['TextInput', 'Textarea', 'Dropdown', 'Checkbox', 'Radio', 'FileUpload']).default('TextInput'),
  requirement: z.enum(['Mandatory', 'Optional', 'If Available'], { required_error: "Requirement level is required." }).default('Optional'),
  availableQuestion: z.string().trim().optional().default(''),
  maxLength: z.coerce.number().int("Max length must be an integer.").min(0, "Max length must be a non-negative number.").optional().default(0),
  options: z.array(z.string()).optional().default([]),
  countryCode: z.string().nullable().optional().default('+91'),
  isMultipleUpload: z.boolean().nullable().optional().default(false),
  isCountryCodeEnabled: z.boolean().nullable().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.requirement === 'If Available' && !data.availableQuestion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conditional question is required when requirement is 'If Available'.",
      path: ["availableQuestion"],
    });
  }
  if (data.fieldType === 'PAN' && data.maxLength !== 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "PAN must contain exactly 10 characters.",
      path: ["maxLength"],
    });
  }
  if (data.fieldType === 'GSTIN' && data.maxLength !== 15) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "GSTIN must contain exactly 15 characters.",
      path: ["maxLength"],
    });
  }
  if (['Dropdown', 'Checkbox', 'Radio'].includes(data.inputType)) {
    if (!data.options || data.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one option.",
        path: ["options"],
      });
    } else {
      const trimmedOptions = data.options.map(o => o.trim());
      if (trimmedOptions.some(o => o === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options cannot be blank.",
          path: ["options"],
        });
      }
      const uniqueOptions = new Set(trimmedOptions.map(o => o.toLowerCase()));
      if (uniqueOptions.size !== trimmedOptions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Option names must be unique.",
          path: ["options"],
        });
      }
    }
  }
});

export const sectionSchema = z.object({
  sectionName: z.string().trim().min(1, "Section Name is required.").nullable().optional().default(''),
  sectionKey: z.string().optional(),
  fields: z.array(fieldDefinitionSchema).default([])
}).superRefine((data, ctx) => {
  if (data.fields && data.fields.length > 0) {
    const trimmedNames = data.fields.map(f => (f.fieldName || "").trim().toLowerCase());
    const uniqueNames = new Set(trimmedNames);
    if (uniqueNames.size !== trimmedNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate field names are not allowed within the same section.",
        path: ["fields"],
      });
    }
  }
});

export const roleFormSchema = z.object({
  roleName: z.string().trim().min(1, "Role Name is required.").max(100, "Too long.").nullable().optional().default(''),
  isManagementRole: z.boolean().optional().default(false),
  minMembers: z.coerce.number().int("Must be an integer.").min(0, "Min members must be non-negative.").default(0),
  maxMembers: z.union([
    z.coerce.number().int("Must be an integer.").min(0),
    z.literal(-1) // represents unlimited
  ]).default(0),
  hierarchyLevel: z.coerce.number().int("Must be an integer.").min(1, "Hierarchy level must be 1 or greater.").default(1),
  designations: z.array(z.string().trim().min(1, "Designation cannot be blank.")).default([]),
  requiredDetails: z.array(sectionSchema).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.maxMembers !== -1 && data.maxMembers < data.minMembers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Maximum members cannot be less than minimum members.",
      path: ["maxMembers"],
    });
  }
  
  if (data.designations && data.designations.length > 0) {
    const trimmedDesig = data.designations.map(d => d.trim().toLowerCase());
    const uniqueDesig = new Set(trimmedDesig);
    if (uniqueDesig.size !== trimmedDesig.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate designations are not allowed.",
        path: ["designations"],
      });
    }
  }
  
  if (data.requiredDetails && data.requiredDetails.length > 0) {
    const trimmedNames = data.requiredDetails.map(s => (s.sectionName || "").trim().toLowerCase());
    const uniqueNames = new Set(trimmedNames);
    if (uniqueNames.size !== trimmedNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate section names are not allowed within the same role.",
        path: ["requiredDetails"],
      });
    }
  }
});

export const businessTypeFormSchema = z.object({
  businessType: z.string().trim().min(1, "Primary Constitution is required.").max(100),
  businessSubType: z.string().trim().min(1, "Sub Category is required.").max(100),
  display_order: z.coerce.number().int("Must be an integer.").min(0, "Display order is required and must be 0 or higher.").default(0),
  sub_display_order: z.coerce.number().int("Must be an integer.").min(0, "Sub Display order is required and must be 0 or higher.").default(0),
  requiredSections: z.array(sectionSchema).optional().default([]),
  roles: z.array(roleFormSchema).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.roles && data.roles.length > 0) {
    const hasManagementRole = data.roles.some(role => role.isManagementRole);
    if (!hasManagementRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one role must be designated as a Management Role for signing/approval authority.",
        path: ["roles"],
      });
    }
    const roleNames = data.roles.map(r => (r.roleName || "").trim().toLowerCase());
    const uniqueRoleNames = new Set(roleNames);
    if (uniqueRoleNames.size !== roleNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate role names are not allowed within the same constitution.",
        path: ["roles"],
      });
    }
  }
  
  if (data.requiredSections && data.requiredSections.length > 0) {
    const sectionNames = data.requiredSections.map(s => (s.sectionName || "").trim().toLowerCase());
    const uniqueSectionNames = new Set(sectionNames);
    if (uniqueSectionNames.size !== sectionNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate section names are not allowed.",
        path: ["requiredSections"],
      });
    }
  }
});

export type FieldDefinitionValues = z.infer<typeof fieldDefinitionSchema>;
export type RoleFormValues = z.infer<typeof roleFormSchema>;
export type BusinessTypeFormValues = z.infer<typeof businessTypeFormSchema>;