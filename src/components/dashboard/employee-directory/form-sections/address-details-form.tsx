'use client';

import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { useStates } from '@/hooks/use-states';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';


const addressSchema = z.object({
  aadharNumber: z.string().regex(/^\d{12}$/, { message: 'Aadhar number must be 12 digits.' }).optional().or(z.literal('')),
  buildingHouseNo: z.string()
    .min(1, 'Building/House No. is required')
    .max(100, "Cannot exceed 100 characters."),
  buildingApartmentName: z.string()
    .max(100, "Cannot exceed 100 characters.")
    .optional(),
  streetArea: z.string()
    .min(1, 'Street/Area is required')
    .max(100, "Cannot exceed 100 characters."),
  cityTownVillage: z.string()
    .min(1, 'City/Town/Village is required')
    .max(50, "Cannot exceed 50 characters.")
    .regex(/^[a-zA-Z\s.\-']+$/, "City/Town/Village contains invalid characters."),
  country: z.string()
    .min(1, 'Country is required')
    .max(50, "Cannot exceed 50 characters.")
    .regex(/^[a-zA-Z\s.\-']+$/, "Country contains invalid characters."),
  stateProvince: z.string().min(1, 'State/Province is required'),
  district: z.string()
    .min(1, 'District is required')
    .max(50, "Cannot exceed 50 characters.")
    .regex(/^[a-zA-Z\s.\-']+$/, "District contains invalid characters."),
  pincode: z.string()
    .min(1, 'Pincode is required')
    .regex(/^\d{6}$/, { message: 'Invalid pincode format (must be 6 digits).' }),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const addressDetailsSchema = z.object({
  permanentAddress: addressSchema,
  isCurrentSameAsPermanent: z.boolean().default(false),
  currentAddress: addressSchema.optional(),
}).superRefine((data, ctx) => {
  if (!data.isCurrentSameAsPermanent) {
    const currentAddressResult = addressSchema.safeParse(data.currentAddress);
    if (!currentAddressResult.success) {
      currentAddressResult.error.errors.forEach(err => {
        ctx.addIssue({
          ...err,
          path: ['currentAddress', ...err.path],
        });
      });
    }
  }
});


export type AddressDetailsFormValues = z.infer<typeof addressDetailsSchema>;

type AddressType = 'permanentAddress' | 'currentAddress';

const DEFAULT_LAT = 8.504391287203669;
const DEFAULT_LNG = 76.96805215217263;


const AddressFields = ({ type, isDisabled }: {
  type: AddressType,
  isDisabled: boolean,
}) => {
  const { control, getValues, setValue } = useFormContext();
  const { states, loading: statesLoading } = useStates();

  const handlePermanentAddressChange = (fieldName: string, value: string | number) => {
    const isSynced = getValues('addressDetails.isCurrentSameAsPermanent');
    if (type === 'permanentAddress' && isSynced) {
      setValue(`addressDetails.currentAddress.${fieldName}`, value, { shouldValidate: true, shouldDirty: true });
    }
  };

  const aadharField = (
    <FormField
      control={control}
      name="addressDetails.permanentAddress.aadharNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Aadhar Number</FormLabel>
          <FormControl>
            <Input
              placeholder="12-digit Aadhar number"
              {...field}
              onChange={(e) => {
                const { value } = e.target;
                const numericValue = value.replace(/\D/g, '');
                if (numericValue.length <= 12) {
                  field.onChange(numericValue);
                  handlePermanentAddressChange('aadharNumber', numericValue);
                }
              }}
              disabled={isDisabled}
              className={cn(field.value && 'border-green-300')}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="space-y-6">
      {type === 'permanentAddress' ? aadharField : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={control}
          name={`addressDetails.${type}.buildingHouseNo`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Building/House Number <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g., 123, A-Block" {...field} value={field.value || ''} disabled={isDisabled} maxLength={100} onChange={e => {
                  field.onChange(e);
                  handlePermanentAddressChange('buildingHouseNo', e.target.value);
                }} className={cn(field.value && 'border-green-300')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`addressDetails.${type}.buildingApartmentName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Building/Apartment Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Sunshine Apartments" {...field} value={field.value || ''} disabled={isDisabled} maxLength={100} onChange={e => {
                  field.onChange(e);
                  handlePermanentAddressChange('buildingApartmentName', e.target.value);
                }} className={cn(field.value && 'border-green-300')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name={`addressDetails.${type}.streetArea`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street/Area <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="e.g., Main Street, MG Road" {...field} value={field.value || ''} disabled={isDisabled} maxLength={100} onChange={e => {
                field.onChange(e);
                handlePermanentAddressChange('streetArea', e.target.value);
              }} className={cn(field.value && 'border-green-300')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={control}
          name={`addressDetails.${type}.cityTownVillage`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>City/Town/Village <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Bangalore" 
                  {...field} 
                  value={field.value || ''} 
                  disabled={isDisabled} 
                  maxLength={50}
                  onChange={e => {
                    const value = e.target.value.replace(/[^a-zA-Z\s.\-']/g, '');
                    field.onChange(value);
                    handlePermanentAddressChange('cityTownVillage', value);
                  }} 
                  className={cn(field.value && 'border-green-300')} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`addressDetails.${type}.country`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., India" 
                  {...field} 
                  value={field.value || ''} 
                  disabled={isDisabled} 
                  maxLength={50}
                  onChange={e => {
                    const value = e.target.value.replace(/[^a-zA-Z\s.\-']/g, '');
                    field.onChange(value);
                    handlePermanentAddressChange('country', value);
                  }} 
                  className={cn(field.value && 'border-green-300')} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormField
          control={control}
          name={`addressDetails.${type}.stateProvince`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>State/Province <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Combobox
                  options={states}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    handlePermanentAddressChange('stateProvince', value);
                  }}
                  placeholder={statesLoading ? "Loading states..." : "Select state"}
                  searchPlaceholder="Search state..."
                  emptyText="No state found."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`addressDetails.${type}.district`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>District <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., Ernakulam" 
                  {...field} 
                  value={field.value || ''} 
                  disabled={isDisabled} 
                  maxLength={50}
                  onChange={e => {
                    const value = e.target.value.replace(/[^a-zA-Z\s.\-']/g, '');
                    field.onChange(value);
                    handlePermanentAddressChange('district', value);
                  }} 
                  className={cn(field.value && 'border-green-300')} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`addressDetails.${type}.pincode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pincode <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., 560001" 
                  {...field} 
                  value={field.value || ''} 
                  disabled={isDisabled} 
                  maxLength={6}
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '');
                    field.onChange(value);
                    handlePermanentAddressChange('pincode', value);
                  }} 
                  className={cn(field.value && 'border-green-300')} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
        <FormField control={control} name={`addressDetails.${type}.latitude`} render={({ field }) => (<FormItem><FormLabel>Latitude</FormLabel><FormControl><Input type="number" placeholder="e.g., 12.9716" {...field} value={field.value || ''} disabled={isDisabled} onChange={e => {
          field.onChange(e);
          handlePermanentAddressChange('latitude', e.target.value);
        }} className={cn(field.value && field.value !== DEFAULT_LAT && 'border-green-300')} /></FormControl><FormMessage /></FormItem>)} />

        <div className="flex gap-2 items-end">
          <FormField control={control} name={`addressDetails.${type}.longitude`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Longitude</FormLabel><FormControl><Input type="number" placeholder="e.g., 77.5946" {...field} value={field.value || ''} disabled={isDisabled} onChange={e => {
            field.onChange(e);
            handlePermanentAddressChange('longitude', e.target.value);
          }} className={cn(field.value && field.value !== DEFAULT_LNG && 'border-green-300')} /></FormControl><FormMessage /></FormItem>)} />

          <MapModal type={type} />
        </div>
      </div>
    </div>
  );
};


const MapModal = ({ type }: { type: AddressType }) => {
  const { watch } = useFormContext();
  const lat = watch(`addressDetails.${type}.latitude`) || DEFAULT_LAT;
  const lng = watch(`addressDetails.${type}.longitude`) || DEFAULT_LNG;
  const mapUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 mb-[2px]" title="View on Map">
          <MapPin className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="border-b pb-4 p-4 shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Location Preview ({lat}, {lng})
          </DialogTitle>
          <DialogDescription className="sr-only">
            This map shows the location of the selected address.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 w-full min-h-[500px]">
          <iframe
            src={mapUrl}
            className="w-full h-full border-0"
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export function AddressDetailsForm() {
  const { control, setValue, watch, getValues, trigger } = useFormContext();
  const isCurrentSameAsPermanent = watch('addressDetails.isCurrentSameAsPermanent');

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Address Details</CardTitle>
        <CardDescription>Provide permanent and current address information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 px-0">
        <div>
          <h3 className="text-lg font-semibold mb-4 text-primary">Permanent Address</h3>
          <AddressFields
            type="permanentAddress"
            isDisabled={false}
          />
        </div>

        <FormField
          control={control}
          name="addressDetails.isCurrentSameAsPermanent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) {
                      const permanentAddress = getValues('addressDetails.permanentAddress');
                      setValue('addressDetails.currentAddress', permanentAddress, { shouldValidate: true, shouldDirty: true });
                    }
                    trigger('addressDetails.currentAddress');
                  }}
                  id="isCurrentSameAsPermanentCheckbox"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label htmlFor="isCurrentSameAsPermanentCheckbox" className="font-medium cursor-pointer">
                  Current address is the same as permanent address
                </Label>
              </div>
            </FormItem>
          )}
        />

        <div>
          <h3 className="text-lg font-semibold mb-4 mt-6 text-primary">Current Address</h3>
          <AddressFields
            type="currentAddress"
            isDisabled={isCurrentSameAsPermanent}
          />
        </div>
      </CardContent>
    </Card>
  );
}
