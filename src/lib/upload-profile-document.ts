import { supabase } from './supabase';

export interface ProfileFileMetadata {
  path: string;
  publicUrl?: string;
  name: string;
  mimeType: string;
  size: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

/**
 * Validates file type and size.
 */
export function validateProfileFile(file: File): { isValid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { isValid: false, error: 'Unsupported file type. Only PDF, PNG, and JPG are allowed.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'File size exceeds the 5 MB limit.' };
  }
  return { isValid: true };
}

/**
 * Uploads a profile document to the private 'profile-documents' bucket.
 */
export async function uploadProfileDocument(
  file: File,
  businessProfileId: string,
  fieldKey: string
): Promise<ProfileFileMetadata> {
  const validation = validateProfileFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${businessProfileId}/${fieldKey}/${timestamp}-${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from('profile-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return {
    path: data.path,
    name: file.name,
    mimeType: file.type,
    size: file.size
  };
}

/**
 * Generates a signed URL for a profile document.
 */
export async function getProfileDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('profile-documents')
    .createSignedUrl(path, 60 * 15); // 15 minutes expiry

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Deletes a file from the 'profile-documents' bucket.
 */
export async function deleteProfileDocument(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('profile-documents')
    .remove([path]);

  if (error) {
    console.error(`Failed to delete storage file at ${path}:`, error.message);
  }
}
