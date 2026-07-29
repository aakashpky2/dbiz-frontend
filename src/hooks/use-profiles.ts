
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// Interfaces
export interface FieldDefinitionData {
  fieldName: string;
  fieldKey: string;
  fieldType: 'Text' | 'Number' | 'Email' | 'Phone' | 'PAN' | 'GSTIN';
  inputType: 'TextInput' | 'Textarea' | 'Dropdown' | 'Checkbox' | 'Radio' | 'FileUpload';
  options?: string[];
  requirement: 'Mandatory' | 'Optional' | 'If Available';
  availableQuestion?: string;
  maxLength?: number;
  countryCode?: string;
  isCountryCodeEnabled?: boolean;
}

export interface SectionData {
  sectionName: string;
  sectionKey: string;
  fields: FieldDefinitionData[];
}

export interface Role {
  roleKey: string;
  roleName: string;
  isManagementRole: boolean;
  minMembers: number;
  maxMembers: number;
  designations: string[];
  requiredDetails: any[]; // Changed to any[] to support both SectionData and FieldDefinitionData during transition
}

export interface BusinessTypeSetup {
  id: string;
  name: string;
  businessType: string;
  businessSubType: string;
  display_order?: number;
  sub_display_order?: number;
  type_subtype_key?: string;
  requiredSections: SectionData[];
  requiredFields: any[]; // Added to match usage in client-form.tsx
  roles: Role[];
}

export interface Profile {
  id: string;
  profileName: string;
  constitutionId: string;
  isDefault?: boolean;
  fields: Record<string, any>;
  roles: Record<string, {
    members: {
      _id: string;
      details: Record<string, any>;
      isSaved?: boolean;
    }[];
  }>;
  signatories?: any[];
  primarySignatories?: Record<string, string>;
}

// Hook to manage multiple profiles
export const useProfiles = () => {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading: loading, refetch: fetchProfiles } = useQuery<Profile[]>({
    queryKey: ['businessProfiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id,profile_name,constitution_id,is_default,fields,roles,signatories,primary_signatories');

      if (error) throw error;

      return data.map(p => ({
        id: p.id,
        profileName: p.profile_name || 'Unnamed Profile',
        constitutionId: p.constitution_id,
        isDefault: p.is_default,
        fields: p.fields || {},
        roles: p.roles || {},
        signatories: p.signatories || [],
        primarySignatories: p.primary_signatories || {}
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { toast } = useToast();

  const addProfile = async (data: Omit<Profile, 'id'>, isFirstProfile: boolean) => {
    try {
      const isDefault = isFirstProfile || data.isDefault;
      if (isDefault) {
        // Reset existing defaults first to ensure only one
        await supabase.from('business_profiles').update({ is_default: false });
      }

      const profileToInsert = {
        profile_name: data.profileName,
        constitution_id: data.constitutionId,
        is_default: isDefault,
        fields: data.fields,
        roles: data.roles,
        signatories: data.signatories || [],
        primary_signatories: data.primarySignatories || {}
      };

      const { error } = await supabase
        .from('business_profiles')
        .insert(profileToInsert);

      if (error) throw error;

      toast({ title: "Success", description: "New profile created successfully." });
      queryClient.invalidateQueries({ queryKey: ['businessProfiles'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const updateProfile = async (profileId: string, data: Partial<Profile>) => {
    try {
      const updates: any = {};
      if (data.profileName !== undefined) updates.profile_name = data.profileName;
      if (data.constitutionId !== undefined) updates.constitution_id = data.constitutionId;
      if (data.isDefault !== undefined) updates.is_default = data.isDefault;
      if (data.fields !== undefined) updates.fields = data.fields;
      if (data.roles !== undefined) updates.roles = data.roles;
      if (data.signatories !== undefined) updates.signatories = data.signatories;
      if (data.primarySignatories !== undefined) updates.primary_signatories = data.primarySignatories;

      const { error } = await supabase
        .from('business_profiles')
        .update(updates)
        .eq('id', profileId);

      if (error) throw error;
      toast({ title: "Success", description: "Profile updated successfully." });
      queryClient.invalidateQueries({ queryKey: ['businessProfiles'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteProfile = async (profileId: string) => {
    try {
      // Check if we are deleting the default profile
      const profToDelete = profiles.find(p => p.id === profileId);
      const isWasDefault = profToDelete?.isDefault;

      const { error } = await supabase
        .from('business_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      // If we deleted the default, set the next one as default if any exist
      if (isWasDefault) {
        const remaining = profiles.filter(p => p.id !== profileId);
        if (remaining.length > 0) {
          await setDefaultProfile(remaining[0].id);
        }
      }

      toast({ title: "Success", description: "Profile purged successfully." });
      queryClient.invalidateQueries({ queryKey: ['businessProfiles'] });
    } catch (error: any) {
      console.error("Delete Profile Error:", error);
      toast({ 
        title: "Deletion Failed", 
        description: error.message || "The database refused this request. Ensure this profile isn't linked to other records.", 
        variant: "destructive" 
      });
    }
  };

  const setDefaultProfile = async (profileId: string) => {
    try {
      // Reset all defaults
      await supabase.from('business_profiles').update({ is_default: false }).neq('id', profileId);
      // Set new default
      const { error } = await supabase.from('business_profiles').update({ is_default: true }).eq('id', profileId);

      if (error) throw error;
      toast({ title: "Default Profile Updated", description: "The default profile has been changed." });
      queryClient.invalidateQueries({ queryKey: ['businessProfiles'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return { profiles, loading, addProfile, updateProfile, deleteProfile, setDefaultProfile, fetchProfiles };
};


// Hook to fetch Business Constitutions
export const useBusinessConstitutions = () => {
  const { data: constitutions = [], isLoading: loading } = useQuery<BusinessTypeSetup[]>({
    queryKey: ['businessConstitutions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_constitutions')
        .select('id,name,business_type,business_sub_type,display_order,sub_display_order,required_fields,roles')
        .order('display_order', { ascending: true })
        .order('sub_display_order', { ascending: true });

      if (error) throw error;

      return data ? data.map(item => ({
        id: item.id,
        name: item.name,
        businessType: item.business_type || '', 
        businessSubType: item.business_sub_type || '',
        display_order: item.display_order || 0,
        sub_display_order: item.sub_display_order || 0,
        requiredSections: item.required_fields || [],
        requiredFields: item.required_fields || [], // Map same data to both keys for compatibility
        roles: item.roles || []
      })) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return { constitutions, loading };
};

