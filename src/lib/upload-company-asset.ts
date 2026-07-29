import { supabase } from './supabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];

export async function uploadCompanyAsset(
    file: File,
    assetType: 'logo' | 'seal' | 'signature',
    businessProfileId?: string | null
): Promise<{ publicUrl: string; path: string }> {
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type. Please upload a JPG, PNG, WEBP, or SVG.');
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds the 5 MB limit.');
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    
    let filePath = '';
    if (businessProfileId) {
        filePath = `profiles/${businessProfileId}/${assetType}-${timestamp}.${extension}`;
    } else {
        filePath = `global/${assetType}-${timestamp}.${extension}`;
    }

    const { data, error } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(data.path);

    if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error('Failed to retrieve public URL from Supabase.');
    }

    return {
        publicUrl: publicUrlData.publicUrl,
        path: data.path
    };
}
