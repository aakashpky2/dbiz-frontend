import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { uploadCompanyAsset } from '@/lib/upload-company-asset';
import { cn } from '@/lib/utils';

export function CompanyBrandingForm({ businessProfileId, isGlobal = false, onSuccess }: { businessProfileId?: string | null, isGlobal?: boolean, onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        company_name: '',
        address: '',
        email: '',
        phone: '',
        gstin: '',
        website: '',
        logo_url: '',
        seal_url: '',
        signature_url: ''
    });

    const fileInputRefs = {
        logo_url: useRef<HTMLInputElement>(null),
        seal_url: useRef<HTMLInputElement>(null),
        signature_url: useRef<HTMLInputElement>(null)
    };

    useEffect(() => {
        loadBranding();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessProfileId, isGlobal]);

    const loadBranding = async () => {
        if (!businessProfileId && !isGlobal) {
            return;
        }

        setLoading(true);
        try {
            const url = isGlobal 
                ? '/api/company-settings/active'
                : `/api/company-settings/active?business_profile_id=${businessProfileId}`;
            const response = await apiFetch(url);
            
            if (response.status === 404) {
                // No branding exists yet, leave defaults
                return;
            }

            const result = await response.json().catch(() => null);
            if (response.ok && result?.success && result?.data) {
                setFormData({
                    company_name: result.data.company_name || '',
                    address: result.data.address || '',
                    email: result.data.email || '',
                    phone: result.data.phone || '',
                    gstin: result.data.gstin || '',
                    website: result.data.website || '',
                    logo_url: result.data.logo_url || '',
                    seal_url: result.data.seal_url || '',
                    signature_url: result.data.signature_url || ''
                });
            } else if (!response.ok) {
                throw new Error(result?.message || result?.error || result?.details || `HTTP ${response.status}`);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to load branding', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (dataToSave = formData) => {
        setSaving(true);
        try {
            const payload = {
                ...dataToSave,
                business_profile_id: businessProfileId || null,
                is_default: isGlobal
            };
            const response = await apiFetch('/api/company-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                console.error('[Branding Save Failed]', result);
                toast({ 
                    title: 'Failed to save branding', 
                    description: result?.message || result?.error || result?.details || `HTTP ${response.status}`, 
                    variant: 'destructive' 
                });
                return;
            }
            toast({ title: 'Success', description: 'Branding settings saved successfully' });
            if (onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to save branding', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'seal_url' | 'signature_url') => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        try {
            setUploading(prev => ({ ...prev, [field]: true }));
            const assetType = field === 'logo_url' ? 'logo' : field === 'seal_url' ? 'seal' : 'signature';
            const { publicUrl } = await uploadCompanyAsset(file, assetType, businessProfileId);
            
            // Update local form state immediately
            const newFormData = { ...formData, [field]: publicUrl };
            setFormData(newFormData);
    
            // Auto-save branding immediately as requested
            const payload = {
                ...newFormData,
                business_profile_id: businessProfileId || null,
                is_default: isGlobal
            };
            const response = await apiFetch('/api/company-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                console.error('[Branding Upload Auto-Save Failed]', result);
                throw new Error(result?.message || result?.error || result?.details || `HTTP ${response.status}`);
            }
            toast({ title: 'Success', description: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} uploaded successfully.` });
    
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Upload failed', variant: 'destructive' });
        } finally {
            setUploading(prev => ({ ...prev, [field]: false }));
            if (fileInputRefs[field].current) {
                fileInputRefs[field].current!.value = '';
            }
        }
    };
    
    const handleRemoveImage = async (field: 'logo_url' | 'seal_url' | 'signature_url') => {
        const newFormData = { ...formData, [field]: '' };
        setFormData(newFormData);
        
        try {
            const payload = {
                ...newFormData,
                business_profile_id: businessProfileId || null,
                is_default: isGlobal
            };
            const response = await apiFetch('/api/company-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                console.error('[Branding Remove Auto-Save Failed]', result);
                toast({ title: 'Failed to remove image', description: result?.message || result?.error || result?.details || `HTTP ${response.status}`, variant: 'destructive' });
                return;
            }
            toast({ title: 'Success', description: 'Image removed successfully.' });
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to remove image.', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
    }

    return (
        <div className="space-y-6 py-4">
            <div className="text-sm text-slate-500 mb-4">
                {isGlobal 
                    ? 'This global branding is used as a fallback if a specific business profile lacks branding.'
                    : 'Branding used for proposals, invoices, quotations, and templates generated under this business profile.'}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Company Display Name</Label>
                    <Input value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} placeholder="e.g. D BIZ CONSULTANCY" />
                </div>
                <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input value={formData.gstin} onChange={e => setFormData({ ...formData, gstin: e.target.value })} placeholder="GST Number" />
                </div>
                <div className="space-y-2 col-span-2">
                    <Label>Address</Label>
                    <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full Address" />
                </div>
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email Address" type="email" />
                </div>
                <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone Number" />
                </div>
                <div className="space-y-2 col-span-2">
                    <Label>Website</Label>
                    <Input value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold">Images & Assets</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 border p-3 rounded-md flex flex-col items-center">
                        <Label className="text-xs">Company Logo</Label>
                        {formData.logo_url ? <img src={formData.logo_url} className="h-12 object-contain" alt="Logo" /> : <div className="h-12 bg-slate-100 w-full flex items-center justify-center text-xs text-slate-400">No Image</div>}
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" className="hidden" ref={fileInputRefs.logo_url} onChange={e => handleFileUpload(e, 'logo_url')} />
                        <div className="flex w-full gap-2 mt-2">
                            <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => fileInputRefs.logo_url.current?.click()} disabled={uploading.logo_url}>
                                {uploading.logo_url ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                {formData.logo_url ? 'Change' : 'Upload'}
                            </Button>
                            {formData.logo_url && (
                                <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 px-2" onClick={() => handleRemoveImage('logo_url')} disabled={uploading.logo_url}>
                                    Remove
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 border p-3 rounded-md flex flex-col items-center">
                        <Label className="text-xs">Company Seal</Label>
                        {formData.seal_url ? <img src={formData.seal_url} className="h-12 object-contain" alt="Seal" /> : <div className="h-12 bg-slate-100 w-full flex items-center justify-center text-xs text-slate-400">No Image</div>}
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" className="hidden" ref={fileInputRefs.seal_url} onChange={e => handleFileUpload(e, 'seal_url')} />
                        <div className="flex w-full gap-2 mt-2">
                            <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => fileInputRefs.seal_url.current?.click()} disabled={uploading.seal_url}>
                                {uploading.seal_url ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                {formData.seal_url ? 'Change' : 'Upload'}
                            </Button>
                            {formData.seal_url && (
                                <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 px-2" onClick={() => handleRemoveImage('seal_url')} disabled={uploading.seal_url}>
                                    Remove
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 border p-3 rounded-md flex flex-col items-center">
                        <Label className="text-xs">Signature</Label>
                        {formData.signature_url ? <img src={formData.signature_url} className="h-12 object-contain" alt="Signature" /> : <div className="h-12 bg-slate-100 w-full flex items-center justify-center text-xs text-slate-400">No Image</div>}
                        <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" className="hidden" ref={fileInputRefs.signature_url} onChange={e => handleFileUpload(e, 'signature_url')} />
                        <div className="flex w-full gap-2 mt-2">
                            <Button type="button" variant="outline" size="sm" className="flex-1 text-xs" onClick={() => fileInputRefs.signature_url.current?.click()} disabled={uploading.signature_url}>
                                {uploading.signature_url ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                {formData.signature_url ? 'Change' : 'Upload'}
                            </Button>
                            {formData.signature_url && (
                                <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 px-2" onClick={() => handleRemoveImage('signature_url')} disabled={uploading.signature_url}>
                                    Remove
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                <p className="text-xs text-slate-400 italic">For PDF generation to work correctly, image URLs must be public and support CORS.</p>
            </div>

            <div className="flex justify-end pt-4">
                <Button type="button" disabled={saving} onClick={() => handleSave(formData)}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                </Button>
            </div>
        </div>
    );
}

export function CompanyBrandingDialog({ businessProfileId, businessProfileName, triggerClassName }: { businessProfileId?: string | null, businessProfileName?: string, triggerClassName?: string }) {
    const [open, setOpen] = useState(false);
    const isGlobal = !businessProfileId;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn(
                        "gap-2 h-11 px-6 rounded-lg font-medium text-sm transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 group shadow-sm hover:shadow-md border-border",
                        isGlobal ? "bg-secondary/50 text-secondary-foreground hover:bg-secondary" : "",
                        triggerClassName
                    )}
                >
                    <Palette className="w-4 h-4 transition-transform duration-200 group-hover:rotate-[3deg]" />
                    {isGlobal ? 'Global Branding' : 'Branding'}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Company Branding
                    </DialogTitle>
                    <DialogDescription>
                        Update your company branding settings.
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <CompanyBrandingForm 
                        businessProfileId={businessProfileId} 
                        isGlobal={isGlobal} 
                        onSuccess={() => setOpen(false)} 
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
